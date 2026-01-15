import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionSheetIOS, Alert, Platform, Pressable, StatusBar, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import Animated, { Easing, FadeIn, FadeOut, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import { vexo } from "vexo-analytics";
import { BASE_PRICE, CANDLE_COUNT, HISTORY_COUNT, MAX_PRICE, MIN_PRICE, PATTERN_SPAWN_CHANCE, TICK_MS } from "./src/constants";
import { CHART_SCRIPT } from "./src/chartScript";
import { BottomControls } from "./src/components/BottomControls";
import { AnimatedSplash } from "./src/components/AnimatedSplash";
import { MarginCallOverlay, type MarginCallVariant } from "./src/components/MarginCallOverlay";
import { PatternSettingsModal } from "./src/components/PatternSettingsModal";
import { ProFeaturesModal } from "./src/components/ProFeaturesModal";
import { TopScoreModal } from "./src/components/TopScoreModal";
import { TotalStatsModal } from "./src/components/TotalStatsModal";
import { ProfitToast } from "./src/components/ProfitToast";
import { RoundResultsSheet, type RoundResult, type RoundStats } from "./src/components/RoundResultsSheet";
import { StackBar, type ChartType } from "./src/components/StackBar";
import { RevenueCatProvider, useRevenueCat } from "./src/contexts/RevenueCatContext";
import { useGameStore } from "./src/stores/useGameStore";
import TwemojiRocket from "./assets/twemoji/1f680.svg";
import TwemojiTrophy from "./assets/twemoji/1f3c6.svg";

// Prevent auto-hiding splash screen
SplashScreen.preventAutoHideAsync();

// Initialize Vexo analytics
const vexoApiKey = Constants.expoConfig?.extra?.vexoApiKey;
if (vexoApiKey) {
  vexo(vexoApiKey);
}
import TwemojiCoin from "./assets/twemoji/1fa99.svg";
import TwemojiWheel from "./assets/twemoji/1f6de.svg";
import TwemojiBanknote from "./assets/twemoji/1f4b5.svg";
import TwemojiFreezingFace from "./assets/twemoji/1f976.svg";
import TwemojiHotFace from "./assets/twemoji/1f975.svg";
import TwemojiSkull from "./assets/twemoji/1f480.svg";
import type { ButtonVariant } from "./src/components/UiButton";
import { UiButton } from "./src/components/UiButton";
import { allPatterns, choosePattern } from "./src/patterns";
import type { Candle } from "./src/types";
import { createCandle, createTargetRunout } from "./src/utils";
import * as GameCenter from "./src/services/GameCenterService";

type ChartBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type PatternLineIndex = {
  id: string;
  kind: "support" | "resistance";
  startIndex: number;
  endIndex: number;
  startPrice: number;
  endPrice: number;
};

type Position = {
  entryPrice: number;
  units: number;
  amount: number;
  side: "long" | "short";
  leverage: number;
  entryTime: number;
};

type TradeToast = {
  kind: "profit" | "loss" | "flat" | "liquidation";
  amount: number;
  percent: number;
};

const CHART_BOTTOM_INSET = 110;
const TOP_SHEET_OFFSET = -240;
const TRADE_SHEET_DETENTS = [0.18];
const TRADE_BAR_GAP = 12;
const LEVERAGE_OPTIONS = [
  { percent: 0.25, leverage: 5 },
  { percent: 0.5, leverage: 10 },
  { percent: 0.75, leverage: 25 },
  { percent: 1, leverage: 50 },
];
const MAINTENANCE_MARGIN = 0.005;
const ROUND_DURATION_MS = 60_000;
const ROUND_END_SLOW_TICK_MS = 300;
const ROUND_END_SHEET_DELAY_MS = 900;

const CHART_HTML = [
  "<!doctype html>",
  "<html>",
  "  <head>",
  '    <meta charset="utf-8" />',
  '    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />',
  "    <style>",
  "      html, body { width: 100%; height: 100%; margin: 0; padding: 0; }",
  "      body { background: #ffffff; font-family: Arial, sans-serif; overflow: hidden; }",
  `      #chart { position: absolute; top: 0; left: 0; right: 0; bottom: ${CHART_BOTTOM_INSET}px; }`,
  "      #overlay {",
  "        position: absolute;",
  `        top: 0; left: 0; right: 0; bottom: ${CHART_BOTTOM_INSET}px;`,
  "        display: flex;",
  "        align-items: center;",
  "        justify-content: center;",
  "        color: #888888;",
  "        font-size: 14px;",
  "        letter-spacing: 0.2px;",
  "      }",
  "    </style>",
  "  </head>",
  "  <body>",
  '    <div id="chart"></div>',
  '    <div id="overlay">Loading chart...</div>',
  "    <script>",
  CHART_SCRIPT,
  "    </script>",
  "  </body>",
  "</html>",
].join("");

const CHART_SOURCE = { html: CHART_HTML };
const WEBVIEW_ORIGIN_WHITELIST = ["*"];

const INJECTED_CHART_SCRIPT = `
  (function () {
    var overlay = document.getElementById("overlay");
    var container = document.getElementById("chart");
    var readyInterval = null;

    function post(payload) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }
    function showOverlay(message) {
      if (overlay) {
        overlay.textContent = message;
        overlay.style.display = "flex";
      }
    }
    function hideOverlay() {
      if (overlay) {
        overlay.style.display = "none";
      }
    }
    if (!container) {
      showOverlay("Missing chart container");
      post({ type: "error", message: "missing-container" });
      return;
    }
    if (!window.LightweightCharts) {
      showOverlay("Chart library missing");
      post({ type: "error", message: "missing-library" });
      return;
    }
    if (!window.__chartState) {
      window.__chartState = {
        chart: null,
        series: null,
        priceType: "candles",
        pending: null,
        didFit: false,
        follow: true,
        didDisableAutoScale: false,
        lineSeries: {},
        markers: [],
        markerApi: null,
        initialSpan: null,
        initialBarSpacing: null,
        initialRightOffset: null,
        didBindInteractions: false,
      };
    }
    var state = window.__chartState;
    if (!state.lineSeries) {
      state.lineSeries = {};
    }
    if (!Array.isArray(state.markers)) {
      state.markers = [];
    }
    if (!("markerApi" in state)) {
      state.markerApi = null;
    }
    if (!("initialSpan" in state)) {
      state.initialSpan = null;
    }
    if (!("initialBarSpacing" in state)) {
      state.initialBarSpacing = null;
    }
    if (!("initialRightOffset" in state)) {
      state.initialRightOffset = null;
    }
    if (!("follow" in state)) {
      state.follow = true;
    }
    if (!("didBindInteractions" in state)) {
      state.didBindInteractions = false;
    }
    if (!("didDisableAutoScale" in state)) {
      state.didDisableAutoScale = false;
    }
    if (!("priceType" in state)) {
      state.priceType = "candles";
    }

    function mapOhlcToLine(data) {
      var safe = Array.isArray(data) ? data : [];
      var out = [];
      for (var i = 0; i < safe.length; i += 1) {
        var bar = safe[i];
        if (!bar) continue;
        var time = Number(bar.time);
        var close = Number(bar.close);
        if (!isFinite(time) || !isFinite(close)) continue;
        out.push({ time: time, value: close });
      }
      return out;
    }

    function removePriceSeries() {
      try {
        if (state.chart && state.series && typeof state.chart.removeSeries === "function") {
          state.chart.removeSeries(state.series);
        }
      } catch (e) {
        // Ignore.
      }
      state.series = null;
      state.markerApi = null;
    }

    function ensurePriceSeries(type) {
      if (!state.chart) {
        return false;
      }
      var nextType =
        type === "line" || type === "area" || type === "baseline" ? type : "candles";
      if (state.series && state.priceType === nextType) {
        return true;
      }
      removePriceSeries();
      state.priceType = nextType;

      if (nextType === "line") {
        var lineOptions = {
          color: "#26a69a",
          lineWidth: 2,
          lineStyle: 0,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: "price", precision: 0, minMove: 1 },
        };
        if (typeof state.chart.addLineSeries === "function") {
          state.series = state.chart.addLineSeries(lineOptions);
        } else if (
          typeof state.chart.addSeries === "function" &&
          window.LightweightCharts &&
          window.LightweightCharts.LineSeries
        ) {
          state.series = state.chart.addSeries(window.LightweightCharts.LineSeries, lineOptions);
        } else {
          throw new Error("LineSeries API missing");
        }
        return !!state.series;
      }

      if (nextType === "area") {
        var areaOptions = {
          lineColor: "#26a69a",
          topColor: "rgba(38, 166, 154, 0.35)",
          bottomColor: "rgba(38, 166, 154, 0.02)",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: "price", precision: 0, minMove: 1 },
        };
        if (typeof state.chart.addAreaSeries === "function") {
          state.series = state.chart.addAreaSeries(areaOptions);
        } else if (
          typeof state.chart.addSeries === "function" &&
          window.LightweightCharts &&
          window.LightweightCharts.AreaSeries
        ) {
          state.series = state.chart.addSeries(window.LightweightCharts.AreaSeries, areaOptions);
        } else {
          throw new Error("AreaSeries API missing");
        }
        return !!state.series;
      }

      if (nextType === "baseline") {
        var baseValuePrice = 0;
        if (Array.isArray(state.pending) && state.pending.length) {
          var firstBar = state.pending[0];
          if (firstBar && isFinite(Number(firstBar.close))) {
            baseValuePrice = Number(firstBar.close);
          }
        }
        var baselineOptions = {
          baseValue: { type: "price", price: baseValuePrice },
          topLineColor: "#26a69a",
          topFillColor1: "rgba(38, 166, 154, 0.35)",
          topFillColor2: "rgba(38, 166, 154, 0.02)",
          bottomLineColor: "#ef5350",
          bottomFillColor1: "rgba(239, 83, 80, 0.25)",
          bottomFillColor2: "rgba(239, 83, 80, 0.02)",
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          priceFormat: { type: "price", precision: 0, minMove: 1 },
        };
        if (typeof state.chart.addBaselineSeries === "function") {
          state.series = state.chart.addBaselineSeries(baselineOptions);
        } else if (
          typeof state.chart.addSeries === "function" &&
          window.LightweightCharts &&
          window.LightweightCharts.BaselineSeries
        ) {
          state.series = state.chart.addSeries(window.LightweightCharts.BaselineSeries, baselineOptions);
        } else {
          throw new Error("BaselineSeries API missing");
        }
        return !!state.series;
      }

      var seriesOptions = {
        upColor: "#26a69a",
        downColor: "#ef5350",
        borderVisible: false,
        wickUpColor: "#26a69a",
        wickDownColor: "#ef5350",
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      };
      if (typeof state.chart.addCandlestickSeries === "function") {
        state.series = state.chart.addCandlestickSeries(seriesOptions);
      } else if (typeof state.chart.addSeries === "function") {
        if (!window.LightweightCharts || !window.LightweightCharts.CandlestickSeries) {
          throw new Error("CandlestickSeries API missing");
        }
        state.series = state.chart.addSeries(window.LightweightCharts.CandlestickSeries, seriesOptions);
      } else {
        throw new Error("Chart series API missing");
      }
      return !!state.series;
    }

    function disableFollow(reason) {
      if (state.follow) {
        state.follow = false;
        post({ type: "debug", message: "follow:off:" + (reason || "user") });
      }
    }

    function getLastBar() {
      var data = state.pending;
      return Array.isArray(data) && data.length ? data[data.length - 1] : null;
    }

    function getPriceScaleApi() {
      try {
        if (state.chart && typeof state.chart.priceScale === "function") {
          return state.chart.priceScale("right");
        }
        if (state.series && typeof state.series.priceScale === "function") {
          return state.series.priceScale();
        }
      } catch (e) {
        // Ignore.
      }
      return null;
    }

    function disableAutoScaleOnce() {
      if (state.didDisableAutoScale) {
        return;
      }
      var ps = getPriceScaleApi();
      if (!ps || typeof ps.setAutoScale !== "function") {
        return;
      }
      try {
        ps.setAutoScale(false);
        state.didDisableAutoScale = true;
        post({ type: "debug", message: "priceScale:autoScale:off" });
      } catch (e) {
        // Ignore.
      }
    }

    function getCurrentVisiblePriceRange() {
      var ps = getPriceScaleApi();
      if (ps && typeof ps.getVisibleRange === "function") {
        var range = ps.getVisibleRange();
        if (range && isFinite(range.from) && isFinite(range.to)) {
          return { from: Math.min(range.from, range.to), to: Math.max(range.from, range.to) };
        }
      }
      if (!state.series || typeof state.series.coordinateToPrice !== "function") {
        return null;
      }
      var height = (container && container.clientHeight) || window.innerHeight || 0;
      if (!height) {
        return null;
      }
      var top = state.series.coordinateToPrice(0);
      var bottom = state.series.coordinateToPrice(height);
      if (!isFinite(Number(top)) || !isFinite(Number(bottom))) {
        return null;
      }
      return { from: Math.min(Number(top), Number(bottom)), to: Math.max(Number(top), Number(bottom)) };
    }

    function followPriceTo(value) {
      if (!isFinite(Number(value))) {
        return;
      }
      var ps = getPriceScaleApi();
      if (!ps || typeof ps.setVisibleRange !== "function") {
        return;
      }

      var range = getCurrentVisiblePriceRange();
      if (!range) {
        return;
      }
      var span = range.to - range.from;
      if (!isFinite(span) || span <= 0) {
        return;
      }

      // Keep scale span the same; only pan the range when price approaches edges.
      var edge = span * 0.18;
      var within = Number(value) >= range.from + edge && Number(value) <= range.to - edge;
      if (within) {
        return;
      }

      // Center the price when it hits the edge band.
      var center = Number(value);
      var half = span / 2;
      try {
        if (typeof ps.setAutoScale === "function") {
          ps.setAutoScale(false);
        }
      } catch (e) {
        // Ignore.
      }
      ps.setVisibleRange({ from: center - half, to: center + half });
    }

    function getBarStepSeconds(data) {
      if (!Array.isArray(data) || data.length < 2) {
        return 60;
      }
      var last = data[data.length - 1];
      var prev = data[data.length - 2];
      var step = prev && isFinite(Number(prev.time)) && isFinite(Number(last.time)) ? Math.abs(Number(last.time) - Number(prev.time)) : 60;
      return step > 0 ? step : 60;
    }

    function followToLastBar() {
      if (!state.chart || !state.chart.timeScale) {
        return;
      }
      var timeScale = state.chart.timeScale();
      var data = state.pending;
      var last = getLastBar();
      if (!last || !isFinite(Number(last.time))) {
        return;
      }

      // Follow should *not* change zoom/scales; only pan the current view.
      // Prefer built-in scroll APIs (pan-only).
      if (timeScale && typeof timeScale.scrollToRealTime === "function") {
        timeScale.scrollToRealTime();
        followPriceTo(last.close);
        return;
      }
      if (timeScale && typeof timeScale.scrollToPosition === "function") {
        // 0 keeps the latest bar at the right edge.
        timeScale.scrollToPosition(0, false);
        followPriceTo(last.close);
        return;
      }
      if (!timeScale || typeof timeScale.setVisibleRange !== "function") {
        followPriceTo(last.close);
        return;
      }

      var currentSpanSeconds = null;
      if (typeof timeScale.getVisibleRange === "function") {
        var currentRange = timeScale.getVisibleRange();
        if (currentRange && isFinite(currentRange.from) && isFinite(currentRange.to)) {
          var spanSeconds = Number(currentRange.to) - Number(currentRange.from);
          if (isFinite(spanSeconds) && spanSeconds > 0) {
            currentSpanSeconds = spanSeconds;
          }
        }
      }

      var step = getBarStepSeconds(data);
      var spanSecondsFallback = null;
      var bars = state.initialSpan;
      if (!bars || !isFinite(bars)) {
        bars = Math.min(160, Math.max(40, Array.isArray(data) ? data.length : 80));
      }
      if (step > 0 && isFinite(bars) && bars > 0) {
        spanSecondsFallback = step * bars;
      }
      var spanToUse = currentSpanSeconds || spanSecondsFallback;
      if (!spanToUse || !isFinite(spanToUse) || spanToUse <= 0) {
        followPriceTo(last.close);
        return;
      }

      // Keep a small right padding, but preserve span (no zoom).
      var rightPad = step > 0 ? step * 2 : spanToUse * 0.02;
      var to = Number(last.time) + rightPad;
      timeScale.setVisibleRange({
        from: to - spanToUse,
        to: to,
      });

      followPriceTo(last.close);
    }
    function ensureChart() {
      if (state.chart && state.series) {
        return true;
      }
      if (!container) {
        showOverlay("Missing chart container");
        post({ type: "error", message: "missing-container" });
        return false;
      }
      if (!window.LightweightCharts) {
        showOverlay("Chart library missing");
        post({ type: "error", message: "missing-library" });
        return false;
      }
      try {
        if (!state.chart) {
          showOverlay("Creating chart...");
          state.chart = LightweightCharts.createChart(container, {
            width: container.clientWidth || window.innerWidth,
            height: container.clientHeight || window.innerHeight,
            layout: {
              background: { color: "#ffffff" },
              textColor: "#333333",
            },
            rightPriceScale: { 
              visible: true, 
              autoScale: true,
              scaleMargins: { top: 0.20, bottom: 0.20 } // Add padding for zoomed out view
            },
            timeScale: { 
              timeVisible: true, 
              secondsVisible: false,
              barSpacing: 3 // Smaller = more zoomed out (default is ~6-8)
            },
            grid: {
              vertLines: { color: "#f0f0f0" },
              horzLines: { color: "#f0f0f0" },
            },
            crosshair: { mode: 1 },
          });
        }
        if (!state.series && state.chart) {
          ensurePriceSeries(state.priceType || "candles");
          if (typeof ResizeObserver !== "undefined") {
            var resizeObserver = new ResizeObserver(function () { resizeChart(); });
            resizeObserver.observe(container);
          }
          window.addEventListener("resize", resizeChart);
          resizeChart();
          post({ type: "debug", message: "chart-created" });

          if (!state.didBindInteractions && container) {
            try {
              // Do NOT disable follow on zoom gestures.
              // - wheel is typically used for zoom
              // - pinch zoom uses multi-touch
              container.addEventListener("mousemove", function (e) {
                if (e && e.buttons) {
                  disableFollow("drag");
                }
              });
              container.addEventListener(
                "touchmove",
                function (e) {
                  // If this is a pinch (multi-touch), keep follow enabled.
                  if (e && e.touches && e.touches.length >= 2) {
                    return;
                  }
                  disableFollow("touch-pan");
                },
                { passive: true },
              );
              state.didBindInteractions = true;
            } catch (e) {
              // Ignore event binding errors.
            }
          }
        }
        return !!(state.chart && state.series);
      } catch (err) {
        var message = String(err && err.message ? err.message : err);
        showOverlay("Chart error: " + message);
        post({ type: "error", message: "createChart:" + message });
        return false;
      }
    }
    function resizeChart() {
      if (!state.chart) {
        return;
      }
      var width = container.clientWidth || window.innerWidth;
      var height = container.clientHeight || window.innerHeight;
      state.chart.applyOptions({ width: width, height: height });
    }
    function setData(data) {
      if (!state.series) {
        showOverlay("Series not ready");
        post({ type: "debug", message: "setData:series-missing" });
        return;
      }
      var safe = Array.isArray(data) ? data : [];
      var min = Infinity;
      var max = -Infinity;
      var invalid = false;
      for (var i = 0; i < safe.length; i += 1) {
        var bar = safe[i];
        if (!bar) {
          invalid = true;
          break;
        }
        var time = Number(bar.time);
        var open = Number(bar.open);
        var high = Number(bar.high);
        var low = Number(bar.low);
        var close = Number(bar.close);
        if (!isFinite(time) || !isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) {
          invalid = true;
          break;
        }
        min = Math.min(min, low);
        max = Math.max(max, high);
      }
      if (invalid) {
        showOverlay("Invalid chart data");
        post({ type: "error", message: "invalid-data" });
        return;
      }
      try {
        if (state.priceType === "line" || state.priceType === "area" || state.priceType === "baseline") {
          state.series.setData(mapOhlcToLine(safe));
        } else {
          state.series.setData(safe);
        }
      } catch (err) {
        var errMsg = String(err && err.message ? err.message : err);
        showOverlay("Chart error: " + errMsg);
        post({ type: "error", message: "setData:" + errMsg });
        return;
      }
      if (safe.length) {
        hideOverlay();
        post({ type: "debug", message: "data:" + safe.length + ":min:" + min + ":max:" + max });
        disableAutoScaleOnce();
      } else {
        showOverlay("Waiting for data...");
      }
      var timeScale = state.chart.timeScale && state.chart.timeScale();
      if (!state.didFit) {
        if (timeScale && typeof timeScale.fitContent === "function") {
          timeScale.fitContent();
        }
        state.didFit = true;
        if (
          timeScale &&
          typeof timeScale.getVisibleRange === "function" &&
          safe.length > 1 &&
          state.initialSpan === null
        ) {
          var range = timeScale.getVisibleRange();
          var prev = safe[safe.length - 2];
          var step =
            prev && isFinite(Number(prev.time)) ? Math.abs(Number(prev.time) - Number(safe[safe.length - 1].time)) : 60;
          if (range && isFinite(range.from) && isFinite(range.to) && step > 0) {
            var span = Math.round((range.to - range.from) / step);
            if (span > 0) {
              state.initialSpan = span;
            }
          }
        }
        if (timeScale && typeof timeScale.options === "function" && state.initialBarSpacing === null) {
          var options = timeScale.options();
          if (options) {
            if (isFinite(options.barSpacing)) {
              state.initialBarSpacing = options.barSpacing;
            }
            if (isFinite(options.rightOffset)) {
              state.initialRightOffset = options.rightOffset;
            }
          }
        }
        if (state.follow) {
          followToLastBar();
        }
      } else if (state.follow) {
        followToLastBar();
      }
    }
    function ensureLineSeries(id, kind) {
      if (!state.chart) {
        return null;
      }
      if (!state.lineSeries) {
        state.lineSeries = {};
      }
      if (state.lineSeries[id]) {
        return state.lineSeries[id];
      }
      var color = kind === "resistance" ? "#d94b4b" : "#1a9f7a";
      var options = {
        color: color,
        lineWidth: 2,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false,
      };
      var series = null;
      if (typeof state.chart.addLineSeries === "function") {
        series = state.chart.addLineSeries(options);
      } else if (
        typeof state.chart.addSeries === "function" &&
        window.LightweightCharts &&
        window.LightweightCharts.LineSeries
      ) {
        series = state.chart.addSeries(window.LightweightCharts.LineSeries, options);
      } else {
        post({ type: "error", message: "line-series-api-missing" });
        return null;
      }
      state.lineSeries[id] = series;
      return series;
    }
    function setPatternLines(lines) {
      if (!state.chart) {
        return;
      }
      var list = Array.isArray(lines) ? lines : [];
      var active = {};
      for (var i = 0; i < list.length; i += 1) {
        var line = list[i];
        if (!line || !line.id || !Array.isArray(line.points)) {
          continue;
        }
        active[line.id] = true;
        var series = ensureLineSeries(line.id, line.kind || "support");
        if (series && typeof series.setData === "function") {
          series.setData(line.points);
        }
      }
      if (state.chart && typeof state.chart.removeSeries === "function") {
        Object.keys(state.lineSeries || {}).forEach(function (key) {
          if (!active[key]) {
            state.chart.removeSeries(state.lineSeries[key]);
            delete state.lineSeries[key];
          }
        });
      }
    }
    function ensureMarkers() {
      if (state.markerApi) {
        return true;
      }
      if (!state.series) {
        return false;
      }
      if (typeof state.series.setMarkers === "function") {
        state.markerApi = {
          setMarkers: function (markers) {
            state.series.setMarkers(markers);
          },
        };
        return true;
      }
      if (window.LightweightCharts && typeof window.LightweightCharts.createSeriesMarkers === "function") {
        state.markerApi = window.LightweightCharts.createSeriesMarkers(state.series, []);
        return true;
      }
      return false;
    }
    function handleMessage(event) {
      try {
        var message = JSON.parse(event.data);
        if (message && message.type === "setData") {
          var count = Array.isArray(message.data) ? message.data.length : 0;
          post({ type: "debug", message: "message:setData:" + count });
          state.pending = message.data;
          if (state.series) {
            setData(state.pending);
          }
        }
      } catch (err) {
        // Ignore malformed messages.
      }
    }
    window.__setChartData = function (data) {
      if (readyInterval) {
        clearInterval(readyInterval);
        readyInterval = null;
      }
      var count = Array.isArray(data) ? data.length : 0;
      post({ type: "debug", message: "inject:setData:" + count });
      if (!ensureChart()) {
        post({ type: "debug", message: "inject:series-missing" });
      }
      state.pending = data;
      if (state.series) {
        setData(state.pending);
      }
    };
    window.__updateChartData = function (bar) {
      if (!ensureChart()) {
        return;
      }
      if (!state.series) {
        post({ type: "debug", message: "inject:update:series-missing" });
        return;
      }
      if (!bar) {
        return;
      }
      var time = Number(bar.time);
      var open = Number(bar.open);
      var high = Number(bar.high);
      var low = Number(bar.low);
      var close = Number(bar.close);
      if (
        !isFinite(time) ||
        !isFinite(open) ||
        !isFinite(high) ||
        !isFinite(low) ||
        !isFinite(close)
      ) {
        return;
      }
      if (!Array.isArray(state.pending)) {
        state.pending = [];
      }
      var pending = state.pending;
      if (pending.length && Number(pending[pending.length - 1].time) === time) {
        pending[pending.length - 1] = bar;
      } else {
        pending.push(bar);
        if (pending.length > 800) {
          pending.shift();
        }
      }
      try {
        if (state.priceType === "line" || state.priceType === "area" || state.priceType === "baseline") {
          state.series.update({ time: time, value: close });
        } else {
          state.series.update({ time: time, open: open, high: high, low: low, close: close });
        }
      } catch (err) {
        setData(pending);
      }
      if (pending.length) {
        hideOverlay();
        disableAutoScaleOnce();
      }
      var timeScale = state.chart.timeScale && state.chart.timeScale();
      if (!state.didFit) {
        if (timeScale && typeof timeScale.fitContent === "function") {
          timeScale.fitContent();
        }
        state.didFit = true;
        if (state.follow) {
          followToLastBar();
        }
      } else if (state.follow) {
        followToLastBar();
      }
    };
    window.__setPatternLines = function (lines) {
      if (!ensureChart()) {
        return;
      }
      setPatternLines(lines);
    };

    window.__setChartType = function (type) {
      try {
        if (!ensureChart()) {
          return;
        }
        ensurePriceSeries(type);
        if (state.pending) {
          setData(state.pending);
        }
        if (Array.isArray(state.markers) && state.markers.length) {
          if (ensureMarkers() && state.markerApi && typeof state.markerApi.setMarkers === "function") {
            state.markerApi.setMarkers(state.markers);
          }
        }
        post({ type: "debug", message: "chartType:" + (state.priceType || "candles") });
      } catch (e) {
        post({ type: "error", message: "setChartType:" + String(e && e.message ? e.message : e) });
      }
    };
    window.__resizeChart = function () {
      resizeChart();
      post({ type: "debug", message: "resize:forced" });
    };
    window.__resetView = function () {
      if (!ensureChart()) {
        return;
      }
      if (!state.chart || !state.chart.timeScale) {
        return;
      }
      var timeScale = state.chart.timeScale();
      if (timeScale && typeof timeScale.applyOptions === "function") {
        var resetOptions = {};
        if (isFinite(state.initialBarSpacing)) {
          resetOptions.barSpacing = state.initialBarSpacing;
        }
        if (isFinite(state.initialRightOffset)) {
          resetOptions.rightOffset = state.initialRightOffset;
        }
        if (Object.keys(resetOptions).length) {
          timeScale.applyOptions(resetOptions);
        }
      }
      var data = state.pending;
      var last = Array.isArray(data) && data.length ? data[data.length - 1] : null;
      if (
        timeScale &&
        typeof timeScale.setVisibleRange === "function" &&
        last &&
        isFinite(Number(last.time))
      ) {
        var prev = data.length > 1 ? data[data.length - 2] : null;
        var step = prev && isFinite(Number(prev.time)) ? Math.abs(last.time - prev.time) : 60;
        var span = state.initialSpan;
        if (!span || !isFinite(span)) {
          span = Math.min(160, Math.max(40, data.length));
        }
        timeScale.setVisibleRange({
          from: last.time - step * span,
          to: last.time + step * 6,
        });
        return;
      }
      if (timeScale && typeof timeScale.fitContent === "function") {
        timeScale.fitContent();
      }
    };

    window.__enableFollow = function () {
      if (!ensureChart()) {
        return;
      }
      state.follow = true;
      followToLastBar();
      post({ type: "debug", message: "follow:on" });
    };
    window.__setChartTheme = function (theme) {
      if (!theme) {
        return;
      }
      if (!ensureChart()) {
        return;
      }
      try {
        if (state.chart && typeof state.chart.applyOptions === "function") {
          state.chart.applyOptions({
            layout: {
              background: { color: theme.background || "#ffffff" },
              textColor: theme.textColor || "#333333",
            },
            grid: {
              vertLines: { color: theme.gridColor || "#f0f0f0" },
              horzLines: { color: theme.gridColor || "#f0f0f0" },
            },
            rightPriceScale: { borderColor: theme.borderColor || "#dddddd" },
            timeScale: { borderColor: theme.borderColor || "#dddddd" },
          });
        }
        if (container) {
          container.style.background = theme.background || "#ffffff";
        }
        if (document && document.body) {
          document.body.style.background = theme.background || "#ffffff";
        }
        if (overlay) {
          overlay.style.color = theme.overlayColor || theme.textColor || "#888888";
        }
      } catch (err) {
        post({ type: "error", message: "theme:" + String(err && err.message ? err.message : err) });
      }
    };
    window.__addTrade = function (side) {
      if (!ensureChart()) {
        return;
      }
      if (!ensureMarkers()) {
        post({ type: "debug", message: "markers-api-missing" });
        return;
      }
      var data = state.pending;
      var last = Array.isArray(data) && data.length ? data[data.length - 1] : null;
      if (!last || !isFinite(Number(last.time))) {
        post({ type: "debug", message: "marker-no-data" });
        return;
      }
      var isBuy = side === "buy";
      var isLong = side === "long" || isBuy;
      var isShort = side === "short";
      var isSell = side === "sell";
      var marker = {
        time: last.time,
        position: isLong ? "belowBar" : "aboveBar",
        color: isLong ? "#1a9f7a" : isShort ? "#f5a524" : "#d94b4b",
        shape: isLong ? "arrowUp" : "arrowDown",
        text: isBuy ? "Buy" : isLong ? "Long" : isShort ? "Short" : "Sell",
      };
      if (!Array.isArray(state.markers)) {
        state.markers = [];
      }
      state.markers.push(marker);
      if (state.markers.length > 200) {
        state.markers = state.markers.slice(-200);
      }
      if (state.markerApi && typeof state.markerApi.setMarkers === "function") {
        state.markerApi.setMarkers(state.markers);
      }
    };

    window.__clearTrades = function () {
      if (!ensureChart()) {
        return;
      }
      post({ type: "debug", message: "trades:clear" });
      state.markers = [];
      try {
        if (state.series && typeof state.series.setMarkers === "function") {
          state.series.setMarkers([]);
        }
      } catch (err) {
        // Ignore
      }
      if (ensureMarkers()) {
        if (state.markerApi && typeof state.markerApi.setMarkers === "function") {
          state.markerApi.setMarkers([]);
        }
        if (state.markerApi && typeof state.markerApi.clearMarkers === "function") {
          state.markerApi.clearMarkers();
        }
      } else {
        post({ type: "debug", message: "markers-api-missing" });
      }
    };
    window.addEventListener("message", handleMessage);
    document.addEventListener("message", handleMessage);

    function waitForReady(attempts) {
      if (window.ReactNativeWebView && window.LightweightCharts) {
        if (ensureChart()) {
          // Send ready signal immediately and then periodically until data arrives
          post({ type: "ready" });
          readyInterval = setInterval(function() {
             post({ type: "ready" });
          }, 500);
        }
        
        if (state.pending) {
          setData(state.pending);
        } else {
          showOverlay("Waiting for data...");
        }
        return;
      }
      
      if (attempts > 0) {
        setTimeout(function() { waitForReady(attempts - 1); }, 100);
      } else {
        showOverlay("Chart timeout: missing dependencies");
        // Try to post error just in case bridge works now
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
           window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", message: "init-timeout" }));
        }
      }
    }

    // Try for 10 seconds (100 * 100ms)
    waitForReady(100);
  })();
  true;
`;

function AppContent() {
  const insets = useSafeAreaInsets();
  const { isPro: isProReal, proPrice, purchasePro, restorePurchases, isLoading: isRevenueCatLoading } = useRevenueCat();
  const [debugProOverride, setDebugProOverride] = useState(false);
  const isPro = isProReal || debugProOverride; // Debug override for testing
  const addScore = useGameStore((state) => state.addScore);
  const recordRoundEnd = useGameStore((state) => state.recordRoundEnd);
  const recordTrade = useGameStore((state) => state.recordTrade);
  const recordLeverageUse = useGameStore((state) => state.recordLeverageUse);
  const webViewRef = useRef<WebView>(null);
  const candleIndexRef = useRef(0);
  const baseTimeRef = useRef<number | null>(null);
  const [isWebReady, setIsWebReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(false);
  const [isChartFollowing, setIsChartFollowing] = useState(true);
  const [isMarginCallVisible, setIsMarginCallVisible] = useState(false);
  const isMarginCallVisibleRef = useRef(false);
  const [isTopScoreVisible, setIsTopScoreVisible] = useState(false);
  const [isTotalStatsVisible, setIsTotalStatsVisible] = useState(false);
  const [marginCallVariant, setMarginCallVariant] = useState<MarginCallVariant>("classic");
  const [tickMs, setTickMs] = useState(TICK_MS);
  const marginCallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRoundResultsVisible, setIsRoundResultsVisible] = useState(false);
  const [isRoundEnded, setIsRoundEnded] = useState(false);
  const isRoundResultsVisibleRef = useRef(false);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundSecondsRemaining, setRoundSecondsRemaining] = useState<number | null>(null);
  const [isPatternSettingsVisible, setIsPatternSettingsVisible] = useState(false);
  const [currentPatternLabel, setCurrentPatternLabel] = useState<string | null>(null);
  const roundEndsAtRef = useRef<number | null>(null);
  const roundStartNetWorthRef = useRef(0);
  const roundStatsRef = useRef<RoundStats>({ tradesMade: 0, tradesWon: 0, tradesLost: 0, biggestWinPercent: 0, biggestLossPercent: 0, longestTrade: 0, closestToLiquidation: 100 });
  const roundTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWebReadyRef = useRef(false);
  const latestChartDataRef = useRef<ChartBar[]>([]);
  const patternLinesRef = useRef<PatternLineIndex[]>([]);
  const hasSentFullDataRef = useRef(false);
  const lastFullDataSendAtRef = useRef(0);
  const lineUpdateCounterRef = useRef(0);
  const [enabledPatternIds, setEnabledPatternIds] = useState<string[]>(() => allPatterns.map((pattern) => pattern.id));
  const enabledPatternIdsRef = useRef<string[]>(allPatterns.map((pattern) => pattern.id));
  const [chartType, setChartType] = useState<ChartType>("candles");
  const initialStackBalance = isPro ? 110 : 100;
  const stackBalanceRef = useRef(initialStackBalance);
  const positionsRef = useRef<Position[]>([]);
  const [positionCount, setPositionCount] = useState(0);  // Track position count for re-renders
  const [stackBalance, setStackBalance] = useState(initialStackBalance);
  const [useLeverage, setUseLeverage] = useState(true);
  const darkMode = useGameStore((state) => state.darkMode);
  const setDarkMode = useGameStore((state) => state.setDarkMode);
  const [leverageIndex, setLeverageIndex] = useState(1);
  const [tradeToast, setTradeToast] = useState<TradeToast | null>(null);
  const [showStartHint, setShowStartHint] = useState(false);
  const [showPatternLines, setShowPatternLines] = useState(false);
  const showPatternLinesRef = useRef(false);
  const [rocketBurstTrigger, setRocketBurstTrigger] = useState(0);
  const [moneyPrinterTrigger, setMoneyPrinterTrigger] = useState(0);
  const toastTranslateY = useSharedValue(TOP_SHEET_OFFSET);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTradeLabelRef = useRef<string>("Trade");
  const [isProFeaturesVisible, setIsProFeaturesVisible] = useState(false);

  useEffect(() => {
    // Top up balance if user becomes Pro and hasn't started trading yet (simple check)
    // or just let them enjoy it on next round.
    // For now, let's just ensure if they buy Pro mid-game, they get the boost if they are at the starting balance of 100.
    if (isPro && stackBalanceRef.current === 100) {
      const newBalance = 110;
      setStackBalance(newBalance);
      stackBalanceRef.current = newBalance;
    }
  }, [isPro]);
  const leverageOption = LEVERAGE_OPTIONS[leverageIndex] ?? LEVERAGE_OPTIONS[0];
  const wagerPercent = leverageOption.percent;
  const wagerPercentUsed = useLeverage ? 1 : wagerPercent;
  const leverage = useLeverage ? leverageOption.leverage : 1;
  const wagerOptionLabels = useLeverage
    ? LEVERAGE_OPTIONS.map((option) => `${option.leverage}x`)
    : LEVERAGE_OPTIONS.map((option) => `${Math.round(option.percent * 100)}%`);
  const formatMoney = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue < 100) {
      return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  };
  const formatSignedMoney = (value: number) => {
    const absValue = Math.abs(value);
    const prefix = value > 0 ? "+$" : value < 0 ? "-$" : "$";
    return `${prefix}${formatMoney(absValue)}`;
  };
  const normalizeBalance = (value: number) => {
    const clamped = Math.max(0, value);
    if (clamped >= 100) {
      return Math.round(clamped);
    }
    return Math.round(clamped * 100) / 100;
  };

  const computeOpenProceeds = (price: number) => {
    const positions = positionsRef.current;
    if (!positions.length) {
      return 0;
    }
    return positions.reduce((sum, position) => {
      const pnl = position.side === "long" ? (price - position.entryPrice) * position.units : (position.entryPrice - price) * position.units;
      return sum + position.amount + pnl;
    }, 0);
  };

  const computeNetWorth = (price: number) => stackBalanceRef.current + computeOpenProceeds(price);

  const clearRoundTimers = () => {
    if (roundTimeoutRef.current) {
      clearTimeout(roundTimeoutRef.current);
      roundTimeoutRef.current = null;
    }
    if (roundCountdownIntervalRef.current) {
      clearInterval(roundCountdownIntervalRef.current);
      roundCountdownIntervalRef.current = null;
    }
    if (roundRevealTimeoutRef.current) {
      clearTimeout(roundRevealTimeoutRef.current);
      roundRevealTimeoutRef.current = null;
    }
  };

  const resetRoundState = () => {
    clearRoundTimers();
    roundEndsAtRef.current = null;
    roundStartNetWorthRef.current = 0;
    roundStatsRef.current = { tradesMade: 0, tradesWon: 0, tradesLost: 0, biggestWinPercent: 0, biggestLossPercent: 0, longestTrade: 0, closestToLiquidation: 100 };
    setRoundSecondsRemaining(null);
    setIsRoundResultsVisible(false);
    setIsRoundEnded(false);
  };

  const closeAllPositionsAtPrice = (price: number, options: { showToast: boolean }) => {
    if (positionsRef.current.length === 0) {
      return;
    }
    const costBasis = positionsRef.current.reduce((sum, position) => sum + position.amount, 0);
    const earliestEntry = Math.min(...positionsRef.current.map((p) => p.entryTime));
    const tradeDuration = Date.now() - earliestEntry;
    const proceeds = computeOpenProceeds(price);
    const profit = proceeds - costBasis;
    // In training wheels mode, don't update the actual balance
    const nextBalance = showPatternLinesRef.current 
      ? stackBalanceRef.current 
      : normalizeBalance(stackBalanceRef.current + proceeds);
    stackBalanceRef.current = nextBalance;
    positionsRef.current = [];
    setPositionCount(0);
    setStackBalance(nextBalance);
    sendPatternLines();
    webViewRef.current?.injectJavaScript(`window.__addTrade && window.__addTrade("sell"); true;`);

    // Track trade stats during sprint round
    if (roundEndsAtRef.current && costBasis > 0) {
      const profitPercent = (profit / costBasis) * 100;
      roundStatsRef.current.tradesMade += 1;
      roundStatsRef.current.longestTrade = Math.max(roundStatsRef.current.longestTrade, tradeDuration);
      if (profit > 0) {
        roundStatsRef.current.tradesWon += 1;
        roundStatsRef.current.biggestWinPercent = Math.max(roundStatsRef.current.biggestWinPercent, profitPercent);
      } else if (profit < 0) {
        roundStatsRef.current.tradesLost += 1;
        roundStatsRef.current.biggestLossPercent = Math.max(roundStatsRef.current.biggestLossPercent, Math.abs(profitPercent));
      }

      // Record lifetime trade stats (if not training wheels)
      if (!showPatternLinesRef.current) {
        recordTrade(profit > 0, profit, profitPercent);
      }
    }

    if (options.showToast && costBasis > 0) {
      const percent = (profit / costBasis) * 100;
      const kind = profit > 0 ? "profit" : profit < 0 ? "loss" : "flat";
      showTradeToast({ amount: profit, percent, kind });
    }
  };

  const endSprintRound = () => {
    const endsAt = roundEndsAtRef.current;
    if (!endsAt) {
      return;
    }
    clearRoundTimers();
    setRoundSecondsRemaining(null);

    if (isMarginCallVisibleRef.current || isRoundResultsVisibleRef.current) {
      roundEndsAtRef.current = null;
      return;
    }

    // Immediately disable trading
    setIsRoundEnded(true);

    const price = getCurrentPrice() ?? BASE_PRICE;
    const startNetWorth = roundStartNetWorthRef.current || normalizeBalance(computeNetWorth(price));
    const endNetWorth = normalizeBalance(computeNetWorth(price));
    const profit = endNetWorth - startNetWorth;
    const percent = startNetWorth > 0 ? (profit / startNetWorth) * 100 : 0;

    // Close positions BEFORE clearing roundEndsAtRef so stats are tracked
    if (positionsRef.current.length) {
      closeAllPositionsAtPrice(price, { showToast: false });
    }

    // Now clear the ref after positions are closed
    roundEndsAtRef.current = null;

    setRoundResult({ startNetWorth, endNetWorth, profit, percent, durationMs: ROUND_DURATION_MS, stats: { ...roundStatsRef.current } });
    setTickMs(ROUND_END_SLOW_TICK_MS);

    // Submit score to Game Center
    GameCenter.submitScore(GameCenter.LEADERBOARDS.HIGH_SCORE, endNetWorth);

    // Save score to local leaderboard
    addScore(endNetWorth);

    // Record lifetime stats (only for real rounds, not training wheels)
    if (!showPatternLinesRef.current) {
      recordRoundEnd({
        tradesWon: roundStatsRef.current.tradesWon,
        tradesLost: roundStatsRef.current.tradesLost,
        profitAmount: profit,
        biggestWinPercent: roundStatsRef.current.biggestWinPercent,
        biggestLossPercent: roundStatsRef.current.biggestLossPercent,
        wasLiquidated: false,
        closestToLiquidation: roundStatsRef.current.closestToLiquidation,
        durationMs: ROUND_DURATION_MS,
      });
    }

    roundRevealTimeoutRef.current = setTimeout(() => {
      if (!isMarginCallVisibleRef.current) {
        setIsRoundResultsVisible(true);
      }
      roundRevealTimeoutRef.current = null;
    }, ROUND_END_SHEET_DELAY_MS);
  };

  const startSprintRoundIfNeeded = (price: number) => {
    if (roundEndsAtRef.current) {
      return;
    }
    if (isMarginCallVisibleRef.current || isRoundResultsVisibleRef.current) {
      return;
    }
    // Block game start if training wheels are ON (Pro feature)
    if (showPatternLinesRef.current) {
      return;
    }
    roundStartNetWorthRef.current = normalizeBalance(computeNetWorth(price));
    const endsAt = Date.now() + ROUND_DURATION_MS;
    roundEndsAtRef.current = endsAt;

    setRoundSecondsRemaining(Math.ceil(ROUND_DURATION_MS / 1000));
    if (roundCountdownIntervalRef.current) {
      clearInterval(roundCountdownIntervalRef.current);
    }
    roundCountdownIntervalRef.current = setInterval(() => {
      const msLeft = Math.max(0, (roundEndsAtRef.current ?? endsAt) - Date.now());
      setRoundSecondsRemaining(Math.ceil(msLeft / 1000));
      
      
      if (showStartHint) setShowStartHint(false);

      if (msLeft <= 0) {
        const interval = roundCountdownIntervalRef.current;
        if (interval) clearInterval(interval);
        roundCountdownIntervalRef.current = null;
      }
    }, 200);

    if (roundTimeoutRef.current) {
      clearTimeout(roundTimeoutRef.current);
    }
    roundTimeoutRef.current = setTimeout(() => {
      roundTimeoutRef.current = null;
      endSprintRound();
    }, ROUND_DURATION_MS);
  };

  const wagerAmountRaw = wagerPercentUsed === 1 ? stackBalance : stackBalance * wagerPercentUsed;
  const wagerAmount = stackBalance >= 100 ? Math.floor(wagerAmountRaw) : Math.round(wagerAmountRaw * 100) / 100;
  const hasPositions = positionsRef.current.length > 0;
  const lockedSide = positionsRef.current[0]?.side ?? null;
  const canBuy = wagerAmount >= 0.01;
  const canOpenLong = !useLeverage || !lockedSide || lockedSide === "long";
  const canOpenShort = useLeverage && (!lockedSide || lockedSide === "short");
  const primarySide = lockedSide ?? "long";
  const primaryIsShort = primarySide === "short";
  const minorVariant: ButtonVariant = "bordered";
  const majorVariant: ButtonVariant = "borderedProminent";
  const getCurrentPrice = () => {
    const data = latestChartDataRef.current;
    return data.length ? data[data.length - 1].close : null;
  };

  useEffect(() => {
    isMarginCallVisibleRef.current = isMarginCallVisible;
  }, [isMarginCallVisible]);

  useEffect(() => {
    isRoundResultsVisibleRef.current = isRoundResultsVisible;
  }, [isRoundResultsVisible]);

  const [gameCenterPlayer, setGameCenterPlayer] = useState<GameCenter.GameCenterPlayer | null>(null);

  // Authenticate with Game Center on app launch
  useEffect(() => {
    console.log("Attempting Game Center authentication...");
    GameCenter.authenticate().then((player) => {
      console.log("Game Center auth result:", JSON.stringify(player, null, 2));
      if (player.isAuthenticated) {
        console.log("Game Center authenticated successfully:", player.displayName);
        setGameCenterPlayer(player);
        // Hide the toast after 4 seconds
        setTimeout(() => setGameCenterPlayer(null), 4000);
      } else {
        console.log("Game Center authentication failed or user cancelled.");
      }
    }).catch(error => {
      console.error("Game Center authentication error in App.tsx:", error);
    });
  }, []);

  const chartTheme = useMemo(
    () => ({
      background: darkMode ? "#0d0f12" : "#ffffff",
      textColor: darkMode ? "#e6e6e6" : "#333333",
      gridColor: darkMode ? "#1f2329" : "#f0f0f0",
      borderColor: darkMode ? "#2b2f35" : "#dddddd",
      overlayColor: darkMode ? "#8b9098" : "#888888",
    }),
    [darkMode]
  );
  const getLiquidationPrice = () => {
    const positions = positionsRef.current;
    if (!positions.length) {
      return null;
    }
    const side = positions[0].side;
    const totalMargin = positions.reduce((sum, position) => sum + position.amount, 0);
    const totalNotional = positions.reduce((sum, position) => sum + position.amount * position.leverage, 0);
    const totalUnits = positions.reduce((sum, position) => sum + position.units, 0);
    if (totalMargin <= 0 || totalUnits <= 0) {
      return null;
    }
    const avgEntry = totalNotional / totalUnits;
    const avgLeverage = totalNotional / totalMargin;
    if (!Number.isFinite(avgEntry) || !Number.isFinite(avgLeverage) || avgLeverage <= 0) {
      return null;
    }
    if (avgLeverage <= 1) {
      return null;
    }
    let liquidationPrice =
      side === "long" ? avgEntry * (1 - 1 / avgLeverage + MAINTENANCE_MARGIN) : avgEntry * (1 + 1 / avgLeverage - MAINTENANCE_MARGIN);
    liquidationPrice = Math.max(MIN_PRICE, Math.min(MAX_PRICE, liquidationPrice));
    return { price: liquidationPrice, side };
  };

  useEffect(() => {
    // Show start hint if we are idle and no other overlays are active
    if (roundSecondsRemaining === null && !isMarginCallVisible && !isRoundResultsVisible && !isPatternSettingsVisible && !isTopScoreVisible && !isProFeaturesVisible) {
      const t = setTimeout(() => setShowStartHint(true), 2000);
      return () => clearTimeout(t);
    } else {
      setShowStartHint(false);
    }
  }, [roundSecondsRemaining, isMarginCallVisible, isRoundResultsVisible, isPatternSettingsVisible, isTopScoreVisible, isProFeaturesVisible]);

  const showTradeToast = (toast: TradeToast) => {
    setTradeToast(toast);
    // Haptic feedback based on toast type
    if (toast.kind === "profit") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (toast.kind === "loss" || toast.kind === "liquidation") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    // Animation triggers based on profit magnitude
    if (toast.kind === "profit") {
      if (toast.percent >= 500) {
        setMoneyPrinterTrigger(Date.now());
      } else if (toast.percent >= 250) {
        setRocketBurstTrigger(Date.now());
      }
    }
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (toastHideTimeoutRef.current) {
      clearTimeout(toastHideTimeoutRef.current);
    }
    toastTranslateY.value = withTiming(0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    toastTimeoutRef.current = setTimeout(() => {
      toastTranslateY.value = withTiming(TOP_SHEET_OFFSET, {
        duration: 220,
        easing: Easing.in(Easing.cubic),
      });
      toastHideTimeoutRef.current = setTimeout(() => {
        setTradeToast(null);
      }, 240);
    }, 2400);
  };

  const handleBuyPro = async () => {
    const success = await purchasePro();
    if (success) {
      setIsProFeaturesVisible(false);
      // Optional: Show celebration or thank you
    }
  };

  const openSettings = () => {
    const darkModeOption = darkMode ? "Disable Dark Mode 🌙" : "Enable Dark Mode 🌙";
    const buyProOption = proPrice ? `Buy PRO ✨ (${proPrice})` : "Buy PRO ✨";
    const topScoresOption = "My top Scores 🏆";
    const debugProOption = debugProOverride ? "🔧 Disable Debug Pro" : "🔧 Enable Debug Pro";
    const options = [topScoresOption, "Total Stats 📊"];
    if (isPro) {
        options.push(darkModeOption);
    } else {
        options.push(buyProOption, "Restore Purchases");
    }

    if (__DEV__) {
        options.push(debugProOption);
    }
    options.push("Cancel");
    const cancelIndex = options.length - 1;

    const onSelect = async (index: number) => {
      if (options[index] === darkModeOption) {
        setDarkMode(!darkMode);
      } else if (options[index] === topScoresOption) {
        setIsTopScoreVisible(true);
      } else if (options[index] === "Total Stats 📊") {
        setIsTotalStatsVisible(true);
      } else if (options[index] === buyProOption) {
        setIsProFeaturesVisible(true);
      } else if (options[index] === "Restore Purchases") {
        await restorePurchases();
      } else if (options[index] === debugProOption) {
        setDebugProOverride((prev) => !prev);
      }
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: isPro ? "Pro Member 🏆" : undefined,
          options,
          cancelButtonIndex: cancelIndex,
          userInterfaceStyle: darkMode ? "dark" : "light",
        },
        onSelect
      );
    } else {
      const alertButtons = options.slice(0, -1).map((opt, i) => ({
        text: opt,
        onPress: () => onSelect(i),
      }));
      alertButtons.push({ text: "Cancel", onPress: () => {} });
      Alert.alert("Settings", "Choose an option", alertButtons);
    }
  };


  const pickMarginCallVariant = (): MarginCallVariant => {
    const roll = Math.random();
    if (roll < 0.20) return "incomingCall";
    if (roll < 0.40) return "breakingNews";
    if (roll < 0.60) return "instruction";
    if (roll < 0.80) return "mirror";
    return "classic";
  };

  const applyChartType = (nextType: ChartType) => {
    setChartType(nextType);
    webViewRef.current?.injectJavaScript(`window.__setChartType && window.__setChartType(${JSON.stringify(nextType)}); true;`);
  };

  const resetChartView = () => {
    // Follow should never reset/fit scales; only re-enable follow mode.
    webViewRef.current?.injectJavaScript(`window.__enableFollow && window.__enableFollow(); true;`);
  };

  const resetRun = () => {
    if (marginCallTimeoutRef.current) {
      clearTimeout(marginCallTimeoutRef.current);
      marginCallTimeoutRef.current = null;
    }
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (toastHideTimeoutRef.current) {
      clearTimeout(toastHideTimeoutRef.current);
      toastHideTimeoutRef.current = null;
    }
    toastTranslateY.value = TOP_SHEET_OFFSET;
    setTradeToast(null);

    setIsMarginCallVisible(false);
    resetRoundState();

    stackBalanceRef.current = initialStackBalance;
    setStackBalance(initialStackBalance);
    positionsRef.current = [];
    setPositionCount(0);

    patternQueueRef.current = [];
    targetQueueRef.current = [];
    hasSpawnedPattern.current = false;
    patternLinesRef.current = [];

    candleIndexRef.current = 0;
    baseTimeRef.current = null;
    candlesRef.current = [];
    latestChartDataRef.current = [];
    hasSentFullDataRef.current = false;
    lineUpdateCounterRef.current = 0;

    setTickMs(TICK_MS);

    initializeCandles();
    resetChartView();
    webViewRef.current?.injectJavaScript(`window.__clearTrades && window.__clearTrades(); true;`);
    sendFullChartData();
    sendPatternLines();
  };

  const toggleUseLeverage = () => {
    setUseLeverage((prev) => !prev);
  };

  const dismissRoundResults = () => {
    setTickMs(TICK_MS);
    resetRoundState();
    stackBalanceRef.current = initialStackBalance;
    setStackBalance(initialStackBalance);
    positionsRef.current = [];
    setPositionCount(0);
  };

  const handleBuy = (sideOverride?: "long" | "short") => {
    if (isMarginCallVisible || isRoundResultsVisible) {
      return;
    }
    const price = getCurrentPrice();
    if (!price || !Number.isFinite(price)) {
      return;
    }
    const currentLockedSide = positionsRef.current[0]?.side ?? null;
    const side = sideOverride ?? currentLockedSide ?? "long";
    if (!useLeverage && side === "short") {
      return;
    }
    if (currentLockedSide && currentLockedSide !== side) {
      return;
    }
    const balance = stackBalanceRef.current;
    const amountRaw = wagerPercentUsed === 1 ? balance : balance * wagerPercentUsed;
    const amount = balance >= 100 ? Math.floor(amountRaw) : Math.round(amountRaw * 100) / 100;
    if (amount < 0.01) {
      return;
    }
    startSprintRoundIfNeeded(price);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const positionSize = amount * leverage;
    const units = positionSize / price;
    positionsRef.current = [...positionsRef.current, { entryPrice: price, units, amount, side, leverage, entryTime: Date.now() }];
    setPositionCount(positionsRef.current.length);  // Always update for re-render
    // In training wheels mode, don't update the actual balance or stats
    if (!showPatternLinesRef.current) {
      const nextBalance = normalizeBalance(balance - amount);
      stackBalanceRef.current = nextBalance;
      setStackBalance(nextBalance);
      // Track leverage usage (only for leveraged trades, not spot)
      if (leverage > 1) {
        recordLeverageUse(leverage);
      }
    }
    sendPatternLines();
    const markerSide = useLeverage ? side : "buy";
    webViewRef.current?.injectJavaScript(`window.__addTrade && window.__addTrade("${markerSide}"); true;`);

    const labelSide = side === "short" ? "Short" : useLeverage ? "Long" : "Buy";
    const labelLev = useLeverage ? `${leverage}x` : "Spot";
    lastTradeLabelRef.current = useLeverage ? `${labelSide} ${labelLev}` : `${labelSide} | ${labelLev}`;
  };
  const handleSell = () => {
    if (isMarginCallVisible || isRoundResultsVisible) {
      return;
    }
    const price = getCurrentPrice();
    if (!price || !Number.isFinite(price)) {
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    closeAllPositionsAtPrice(price, { showToast: true });
  };
  const togglePattern = (id: string) => {
    setEnabledPatternIds((prev) => (prev.includes(id) ? prev.filter((patternId) => patternId !== id) : [...prev, id]));
  };

  const patternQueueRef = useRef<Candle[]>([]);
  const targetQueueRef = useRef<Candle[]>([]);
  const hasSpawnedPattern = useRef(false);
  const candlesRef = useRef<Candle[]>([]);

  const ensureBaseTime = (lastIndex: number) => {
    if (baseTimeRef.current === null) {
      baseTimeRef.current = Math.floor(Date.now() / 1000) - lastIndex * 60;
    }
  };

  const buildChartBar = (candle: Candle) => {
    const baseTime = baseTimeRef.current ?? Math.floor(Date.now() / 1000);
    const index = candle.index ?? 0;
    const open = candle.open;
    const close = candle.close;
    const high = Math.max(candle.high, open, close);
    const low = Math.min(candle.low, open, close);
    return {
      time: Math.floor(baseTime + index * 60),
      open,
      high,
      low,
      close,
    };
  };

  const initializeCandles = () => {
    if (candlesRef.current.length) {
      return;
    }
    const seed: Candle[] = [];
    let lastClose = BASE_PRICE;
    for (let i = 0; i < CANDLE_COUNT; i += 1) {
      const next = createCandle(lastClose);
      seed.push({ ...next, index: candleIndexRef.current });
      candleIndexRef.current += 1;
      lastClose = next.close;
    }
    candlesRef.current = seed;
    const lastIndex = seed[seed.length - 1]?.index ?? seed.length - 1;
    ensureBaseTime(lastIndex);
    latestChartDataRef.current = seed.map((candle) => buildChartBar(candle));
  };

  initializeCandles();

  const buildPatternLines = () => {
    const candles = candlesRef.current;
    if (!candles.length) {
      return [];
    }
    const lastIndex = candles[candles.length - 1]?.index ?? candles.length - 1;
    const firstIndex = candles[0]?.index ?? 0;
    const baseTime = baseTimeRef.current ?? Math.floor(Date.now() / 1000) - lastIndex * 60;
    
    // Only include pattern lines if training wheels is enabled
    const lines = showPatternLinesRef.current ? patternLinesRef.current.map((line) => ({
      id: line.id,
      kind: line.kind,
      points: [
        { time: Math.floor(baseTime + line.startIndex * 60), value: line.startPrice },
        { time: Math.floor(baseTime + line.endIndex * 60), value: line.endPrice },
      ],
    })) : [];
    const liquidation = getLiquidationPrice();
    if (liquidation) {
      // Extend line far beyond visible range to ensure full-width rendering
      const farPast = baseTime - 365 * 24 * 60 * 60; // 1 year before
      const farFuture = baseTime + lastIndex * 60 + 365 * 24 * 60 * 60; // 1 year after
      lines.push({
        id: "liquidation-line",
        kind: "resistance",
        points: [
          { time: farPast, value: liquidation.price },
          { time: farFuture, value: liquidation.price },
        ],
      });
    }
    return lines;
  };

  const sendFullChartData = () => {
    if (!isWebReadyRef.current) {
      return;
    }
    const now = Date.now();
    if (now - lastFullDataSendAtRef.current < 600) {
      return;
    }
    lastFullDataSendAtRef.current = now;
    const payload = JSON.stringify(latestChartDataRef.current);
    webViewRef.current?.injectJavaScript(`window.__setChartData && window.__setChartData(${payload}); true;`);
  };

  const sendPatternLines = () => {
    if (!isWebReadyRef.current) {
      return;
    }
    const payload = JSON.stringify(buildPatternLines());
    webViewRef.current?.injectJavaScript(`window.__setPatternLines && window.__setPatternLines(${payload}); true;`);
  };

  const handleWebMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message?.type === "ready") {
        // WebView (re)initialized; force a full resync.
        setIsWebReady(true);
        isWebReadyRef.current = true;
        hasSentFullDataRef.current = false;
        lastFullDataSendAtRef.current = 0;

        setIsChartFollowing(true);
        sendFullChartData();
        sendPatternLines();

        const themePayload = JSON.stringify(chartTheme);
        webViewRef.current?.injectJavaScript(`window.__setChartTheme && window.__setChartTheme(${themePayload}); true;`);
        webViewRef.current?.injectJavaScript(`window.__setChartType && window.__setChartType(${JSON.stringify(chartType)}); true;`);
      } else if (message?.type === "debug") {
        console.log("WebView:", message.message);
        const debugMessage = String(message.message ?? "");
        if (debugMessage.startsWith("data:")) {
          hasSentFullDataRef.current = true;
        }
        if (debugMessage === "follow:on" || debugMessage.startsWith("follow:on:")) {
          setIsChartFollowing(true);
        } else if (debugMessage.startsWith("follow:off")) {
          setIsChartFollowing(false);
        }
      } else if (message?.type === "error") {
        console.warn("WebView error:", message.message);
      }
    } catch (error) {
      console.warn("WebView message parse error:", error);
    }
  };

  useEffect(() => {
    enabledPatternIdsRef.current = enabledPatternIds;
  }, [enabledPatternIds]);

  useEffect(() => {
    isWebReadyRef.current = isWebReady;
    if (isWebReady) {
      setTimeout(() => {
        setShowAnimatedSplash(true);
        // Small delay to let AnimatedSplash mount before revealing
        requestAnimationFrame(() => {
          SplashScreen.hideAsync();
        });
      }, 1000);
    }
  }, [isWebReady]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (toastHideTimeoutRef.current) {
        clearTimeout(toastHideTimeoutRef.current);
      }
      if (marginCallTimeoutRef.current) {
        clearTimeout(marginCallTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isMarginCallVisible) {
      return;
    }
    webViewRef.current?.injectJavaScript(`window.__clearTrades && window.__clearTrades(); true;`);
    const retry = setTimeout(() => {
      webViewRef.current?.injectJavaScript(`window.__clearTrades && window.__clearTrades(); true;`);
    }, 50);
    return () => clearTimeout(retry);
  }, [isMarginCallVisible]);

  useEffect(() => {
    const timer = setInterval(() => {
      const candles = candlesRef.current;
      const lastClose = candles.length ? candles[candles.length - 1].close : BASE_PRICE;
      let shouldUpdateLines = false;
      if (patternQueueRef.current.length === 0 && targetQueueRef.current.length === 0) {
        if (!hasSpawnedPattern.current || Math.random() < PATTERN_SPAWN_CHANCE) {
          const isTraining = showPatternLinesRef.current;
          const enabledIds = isTraining ? enabledPatternIdsRef.current : undefined;
          const pattern = choosePattern(lastClose, enabledIds);
          setCurrentPatternLabel(pattern?.label ?? null);
          if (pattern) {
            const result = pattern.generate(lastClose);
            patternQueueRef.current = result.candles;
            if (result.lines) {
              const patternStartIndex = candleIndexRef.current;
              patternLinesRef.current = result.lines.map((line) => ({
                id: line.id,
                kind: line.type,
                startIndex: patternStartIndex + line.startOffset,
                endIndex: patternStartIndex + line.endOffset,
                startPrice: line.startPrice,
                endPrice: line.endPrice,
              }));
            } else {
              patternLinesRef.current = [];
            }
            const patternClose = result.candles.length > 0 ? result.candles[result.candles.length - 1].close : lastClose;
            targetQueueRef.current = createTargetRunout(patternClose, result.targetPrice);
            hasSpawnedPattern.current = true;
            shouldUpdateLines = true;
          }
        }
      }

      let nextBase: Candle;
      if (patternQueueRef.current.length > 0) {
        nextBase = patternQueueRef.current[0];
        patternQueueRef.current = patternQueueRef.current.slice(1);
      } else if (targetQueueRef.current.length > 0) {
        nextBase = targetQueueRef.current[0];
        targetQueueRef.current = targetQueueRef.current.slice(1);
      } else {
        nextBase = createCandle(lastClose);
      }

      const next = { ...nextBase, index: candleIndexRef.current };
      candleIndexRef.current += 1;
      candles.push(next);
      if (candles.length > HISTORY_COUNT) {
        candles.shift();
      }

      const bar = buildChartBar(next);
      latestChartDataRef.current.push(bar);
      if (latestChartDataRef.current.length > HISTORY_COUNT) {
        latestChartDataRef.current.shift();
      }

      if (isWebReadyRef.current) {
        if (!hasSentFullDataRef.current) {
          sendFullChartData();
        } else {
          const payload = JSON.stringify(bar);
          webViewRef.current?.injectJavaScript(`window.__updateChartData && window.__updateChartData(${payload}); true;`);
        }
      }

      if (positionsRef.current.length && roundEndsAtRef.current) {
        const liquidation = getLiquidationPrice();
        if (liquidation) {
          // Calculate distance to liquidation as percentage
          const distanceToLiq = liquidation.side === "long"
            ? ((bar.close - liquidation.price) / liquidation.price) * 100
            : ((liquidation.price - bar.close) / liquidation.price) * 100;
          // Track the closest we got to liquidation (lower = closer)
          if (distanceToLiq < roundStatsRef.current.closestToLiquidation) {
            roundStatsRef.current.closestToLiquidation = Math.max(0, distanceToLiq);
          }
          
          const isLiquidated = liquidation.side === "long" ? bar.close <= liquidation.price : bar.close >= liquidation.price;
          if (isLiquidated) {
            roundStatsRef.current.closestToLiquidation = 0; // Liquidated = 0%
            // Capture the leverage of the first position for liquidation stats
            const liquidatedLeverage = positionsRef.current[0]?.leverage ?? 0;
            // Count all liquidated positions as trades lost
            const liquidatedPositionCount = positionsRef.current.length;
            roundStatsRef.current.tradesLost += liquidatedPositionCount;
            
            // Capture stats BEFORE resetRoundState resets them
            const capturedStats = { ...roundStatsRef.current };
            const capturedRoundEndsAt = roundEndsAtRef.current;
            const margin = positionsRef.current.reduce((sum, position) => sum + position.amount, 0);
            
            resetRoundState();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            positionsRef.current = [];
            setPositionCount(0);
            webViewRef.current?.injectJavaScript(`window.__clearTrades && window.__clearTrades(); true;`);
            showTradeToast({ kind: "liquidation", amount: -margin, percent: -100 });
            setTickMs(300);
            if (marginCallTimeoutRef.current) {
              clearTimeout(marginCallTimeoutRef.current);
            }
            marginCallTimeoutRef.current = setTimeout(() => {
              setMarginCallVariant(pickMarginCallVariant());
              setIsMarginCallVisible(true);
              marginCallTimeoutRef.current = null;
              
              // Record liquidation in lifetime stats (only for real rounds, not training wheels)
              if (!showPatternLinesRef.current) {
                recordRoundEnd({
                  tradesWon: capturedStats.tradesWon,
                  tradesLost: capturedStats.tradesLost,
                  profitAmount: -margin,
                  biggestWinPercent: capturedStats.biggestWinPercent,
                  biggestLossPercent: capturedStats.biggestLossPercent,
                  wasLiquidated: true,
                  closestToLiquidation: 0,
                  durationMs: capturedRoundEndsAt ? (Date.now() - (capturedRoundEndsAt - ROUND_DURATION_MS)) : ROUND_DURATION_MS,
                  liquidationLeverage: liquidatedLeverage,
                });
              }
            }, 900);
            shouldUpdateLines = true;
          }
        }
      }

      lineUpdateCounterRef.current += 1;
      if (shouldUpdateLines || (positionsRef.current.length && lineUpdateCounterRef.current % 5 === 0)) {
        sendPatternLines();
      }
    }, tickMs);

    return () => clearInterval(timer);
  }, [tickMs]);

  useEffect(() => {
    if (!isWebReady) {
      return;
    }
    const themePayload = JSON.stringify(chartTheme);
    webViewRef.current?.injectJavaScript(`window.__setChartTheme && window.__setChartTheme(${themePayload}); true;`);
  }, [chartTheme, isWebReady]);

  // Update chart when training wheels toggle changes
  useEffect(() => {
    showPatternLinesRef.current = showPatternLines;
    if (!isWebReady) {
      return;
    }
    sendPatternLines();
  }, [showPatternLines, isWebReady]);

  const toastTitle = tradeToast ? `${lastTradeLabelRef.current}  ${formatSignedMoney(tradeToast.amount)}` : "";
  const toastSubtitle = tradeToast
    ? tradeToast.kind === "liquidation"
      ? "-100.00%"
      : tradeToast.kind === "flat"
      ? "0.00%"
      : `${tradeToast.kind === "profit" ? "+" : ""}${tradeToast.percent.toFixed(2)}%`
    : "";
  const toastBackgroundAccessory =
    tradeToast?.kind === "profit" ? (
      tradeToast.percent >= 250 ? null : tradeToast.percent >= 100 ? (
        <View pointerEvents="none" style={styles.profitToastBanknotes}>
          <TwemojiBanknote width={92} height={92} style={styles.profitToastBanknote1} />
          <TwemojiBanknote width={86} height={86} style={styles.profitToastBanknote2} />
          <TwemojiBanknote width={78} height={78} style={styles.profitToastBanknote3} />
          <TwemojiBanknote width={70} height={70} style={styles.profitToastBanknote4} />
          <TwemojiBanknote width={64} height={64} style={styles.profitToastBanknote5} />
        </View>
      ) : (
        <View pointerEvents="none" style={styles.profitToastCoins}>
          <TwemojiCoin width={92} height={92} style={styles.profitToastCoin1} />
          <TwemojiCoin width={86} height={86} style={styles.profitToastCoin2} />
          <TwemojiCoin width={78} height={78} style={styles.profitToastCoin3} />
          <TwemojiCoin width={70} height={70} style={styles.profitToastCoin4} />
          <TwemojiCoin width={64} height={64} style={styles.profitToastCoin5} />
        </View>
      )
    ) : tradeToast?.kind === "liquidation" ? (
      <TwemojiSkull width={150} height={150} style={styles.profitToastSkull} />
    ) : tradeToast?.kind === "loss" ? (
      (() => {
        const lossMagnitude = Math.abs(tradeToast.percent);
        if (lossMagnitude <= 25) {
          return <TwemojiFreezingFace width={150} height={150} style={styles.profitToastLossFace} />;
        }
        if (lossMagnitude <= 50) {
          return <TwemojiHotFace width={150} height={150} style={styles.profitToastLossFace} />;
        }
        return <TwemojiSkull width={150} height={150} style={styles.profitToastSkull} />;
      })()
    ) : null;
  const toastSubtitleStyle =
    tradeToast?.kind === "loss"
      ? styles.profitToastBigValueLoss
      : tradeToast?.kind === "liquidation"
      ? styles.profitToastBigValueLiquidation
      : tradeToast?.kind === "flat"
      ? styles.profitToastBigValueFlat
      : null;

  return (
    <>
      <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, darkMode && styles.containerDark]}>
        <StatusBar barStyle={darkMode ? "light-content" : "dark-content"} />
        <ProfitToast
          visible={!!tradeToast}
          darkMode={darkMode}
          translateY={toastTranslateY}
          title={toastTitle}
          subtitle={toastSubtitle}
          backgroundAccessory={toastBackgroundAccessory}
          subtitleStyle={toastSubtitleStyle}
          styles={styles}
          rocketBurstTrigger={tradeToast?.kind === "profit" && tradeToast.percent >= 250 && tradeToast.percent < 500 ? rocketBurstTrigger : 0}
          moneyPrinterTrigger={tradeToast?.kind === "profit" && tradeToast.percent >= 500 ? moneyPrinterTrigger : 0}
        />
        {/* Game Center Welcome Toast */}
        {gameCenterPlayer?.isAuthenticated && (
           <Animated.View 
             entering={FadeIn.delay(500).duration(500)} 
             exiting={FadeOut.duration(500)}
             style={{ 
               position: 'absolute', 
               top: insets.top + 60, 
               alignSelf: 'center', 
               backgroundColor: darkMode ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.9)', 
               paddingVertical: 8, 
               paddingHorizontal: 16, 
               borderRadius: 20, 
               zIndex: 100,
               borderWidth: 1,
               borderColor: darkMode ? '#333' : '#ddd',
             }}
           >
             <Text style={{ color: darkMode ? '#fff' : '#000', fontSize: 13, fontWeight: '600' }}>
               🎮 Signed in as {gameCenterPlayer.displayName}
             </Text>
           </Animated.View>
        )}
        <StackBar
          stackBalance={stackBalance}
          formatMoney={formatMoney}
          useLeverage={useLeverage}
          leverage={leverage}
          wagerPercentUsed={wagerPercentUsed}
          wagerAmount={wagerAmount}
          roundSecondsRemaining={roundSecondsRemaining}
          darkMode={darkMode}
          chartType={chartType}
          setChartType={applyChartType}
          openSettings={openSettings}
          openPatterns={() => {
            if (isPro) {
              setIsPatternSettingsVisible(true);
            } else {
              setIsProFeaturesVisible(true);
            }
          }}
          openLeaderboard={() => GameCenter.showLeaderboard(GameCenter.LEADERBOARDS.HIGH_SCORE)}
          minorVariant={minorVariant}
          styles={styles}
        />
        <View style={styles.chartWrapper}>
          <WebView
            ref={webViewRef}
            originWhitelist={WEBVIEW_ORIGIN_WHITELIST}
            source={CHART_SOURCE}
            style={styles.webView}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            bounces={false}
            onMessage={handleWebMessage}
            injectedJavaScript={INJECTED_CHART_SCRIPT}
            onLoadStart={() => {
              // Reset on navigation start; the WebView will post { type: "ready" } when the bridge is actually ready.
              setIsWebReady(false);
              isWebReadyRef.current = false;
              hasSentFullDataRef.current = false;
              lastFullDataSendAtRef.current = 0;
            }}
            onLoadEnd={() => {
              // No-op: onLoadEnd can fire after the "ready" handshake.
            }}
            onContentProcessDidTerminate={() => {
              // iOS can kill the WebView process; reload and resync.
              setIsWebReady(false);
              isWebReadyRef.current = false;
              hasSentFullDataRef.current = false;
              lastFullDataSendAtRef.current = 0;
              webViewRef.current?.reload();
            }}
          />
          {typeof roundSecondsRemaining === "number" && (
            <View style={[styles.floatingTimer, darkMode && styles.floatingTimerDark]}>
              <Text style={[styles.floatingTimerText, darkMode && styles.floatingTimerTextDark]}>{Math.max(0, roundSecondsRemaining)}s</Text>
            </View>
          )}
          {!isChartFollowing && (
            <UiButton
              title="⎋ Follow Price"
              onPress={resetChartView}
              variant="borderedProminent"
              color="#1a9f7a"
              controlSize="small"
              style={styles.floatingFollowButton}
              darkMode={darkMode}
            />
          )}
          <BottomControls
            darkMode={darkMode}
            useLeverage={useLeverage}
            toggleUseLeverage={toggleUseLeverage}
            majorVariant={majorVariant}
            minorVariant={minorVariant}
            wagerOptionLabels={wagerOptionLabels}
            leverageIndex={leverageIndex}
            onSelectLeverageIndex={setLeverageIndex}
            hasPositions={positionsRef.current.length > 0}
            primaryIsShort={positionsRef.current[0]?.side === "short"}
            primarySide={positionsRef.current[0]?.side ?? "long"}
            canBuy={canBuy}
            canOpenLong={canOpenLong}
            canOpenShort={canOpenShort}
            onBuy={handleBuy}
            onSell={handleSell}
            disabled={isRoundEnded || isRoundResultsVisible || isMarginCallVisible || (typeof roundSecondsRemaining === "number" && roundSecondsRemaining <= 0)}
            styles={styles}
          />

          {showStartHint && (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              pointerEvents={showPatternLines ? "auto" : "none"}
              style={{ position: 'absolute', top: 10, left: 12, right: 12, alignItems: 'center', zIndex: 10 }}
            >
              <Pressable
                disabled={!showPatternLines}
                onPress={() => {
                  if (showPatternLines) {
                    setShowPatternLines(false);
                    setStackBalance(initialStackBalance);
                    stackBalanceRef.current = initialStackBalance;
                  }
                }}
                style={[styles.startHintContainer, darkMode && styles.startHintContainerDark, { position: 'relative', top: 0, left: 0, right: 0, width: '100%' }]}
              >
                <View pointerEvents="none" style={styles.startHintCoins}>
                  {showPatternLines ? (
                    <>
                      <TwemojiWheel width={72} height={72} style={styles.startHintCoin1} />
                      <TwemojiWheel width={64} height={64} style={styles.startHintCoin2} />
                      <TwemojiWheel width={56} height={56} style={styles.startHintCoin3} />
                    </>
                  ) : (
                    <>
                      <TwemojiCoin width={72} height={72} style={styles.startHintCoin1} />
                      <TwemojiCoin width={64} height={64} style={styles.startHintCoin2} />
                      <TwemojiCoin width={56} height={56} style={styles.startHintCoin3} />
                    </>
                  )}
                </View>
                <View style={[styles.startHintContent, { width: '100%', alignItems: 'center' }]}>
                  <Text style={[styles.startHintKicker, darkMode && styles.startHintKickerDark, { textAlign: 'center' }]}>
                    {showPatternLines ? "Training Wheels ON" : "Ready to trade?"}
                  </Text>
                  <Text style={[styles.startHintText, darkMode && styles.startHintTextDark, { textAlign: 'center' }]}>
                    {showPatternLines ? "Tap to turn off & start playing" : "Hit BUY to start your 60s sprint!"}
                  </Text>
                </View>
              </Pressable>

              {showPatternLines && currentPatternLabel && (
                <View style={{ marginTop: 8, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 12 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "600", textAlign: "center" }}>
                    Forming: {currentPatternLabel}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}

        </View>
        <RoundResultsSheet
          visible={isRoundResultsVisible}
          result={roundResult}
          darkMode={darkMode}
          onShowLeaderboard={() => GameCenter.showLeaderboard(GameCenter.LEADERBOARDS.HIGH_SCORE)}
          onNextRound={() => {
            setIsRoundResultsVisible(false);
            isRoundResultsVisibleRef.current = false;
            dismissRoundResults();
          }}
        />
        <MarginCallOverlay
          visible={isMarginCallVisible}
          darkMode={darkMode}
          variant={marginCallVariant}
          onTryAgain={resetRun}
        />
        <PatternSettingsModal
          visible={isPatternSettingsVisible}
          darkMode={darkMode}
          patterns={allPatterns}
          enabledPatternIds={enabledPatternIds}
          togglePattern={togglePattern}
          showPatternLines={showPatternLines}
          onTogglePatternLines={() => {
            setShowPatternLines((prev) => {
              // If turning OFF training wheels, reset the money stack
              if (prev === true) {
                setStackBalance(initialStackBalance);
                stackBalanceRef.current = initialStackBalance;
              }
              return !prev;
            });
          }}
          onClose={() => setIsPatternSettingsVisible(false)}
        />
        <TopScoreModal
          visible={isTopScoreVisible}
          darkMode={darkMode}
          onClose={() => setIsTopScoreVisible(false)}
        />
        <TotalStatsModal
          visible={isTotalStatsVisible}
          darkMode={darkMode}
          onClose={() => setIsTotalStatsVisible(false)}
        />
        <ProFeaturesModal
          visible={isProFeaturesVisible}
          darkMode={darkMode}
          price={proPrice}
          onBuy={handleBuyPro}
          onClose={() => setIsProFeaturesVisible(false)}
          isPurchasing={isRevenueCatLoading}
        />
      </SafeAreaView>
      {showAnimatedSplash && <AnimatedSplash darkMode={darkMode} onComplete={() => setShowAnimatedSplash(false)} />}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.container}>
      <RevenueCatProvider>
        <AppContent />
      </RevenueCatProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  containerDark: {
    backgroundColor: "#0d0f12",
  },
  chartWrapper: {
    flex: 1,
    paddingBottom: 20,
  },
  webView: {
    flex: 1,
  },
  stackBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    backgroundColor: "#ffffff",
  },
  stackBarDark: {
    borderBottomColor: "#1f2329",
    backgroundColor: "#0d0f12",
  },
  stackLabel: {
    fontSize: 12,
    color: "#666666",
  },
  stackLabelDark: {
    color: "#9aa0a6",
  },
  stackValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111111",
  },
  stackValueDark: {
    color: "#f5f5f5",
  },
  stackBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stackWager: {
    alignItems: "flex-end",
  },
  stackWagerLabel: {
    fontSize: 12,
    color: "#666666",
  },
  stackWagerLabelDark: {
    color: "#9aa0a6",
  },
  stackWagerValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1a9f7a",
  },
  stackWagerValueDark: {
    color: "#8fe3c7",
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  settingsButtonDark: {
    backgroundColor: "transparent",
  },
  chartTypeScroller: {
    maxWidth: 140,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  chartTypeScrollerDark: {
    // Keep transparent; UiButton variants handle the visuals.
  },
  chartTypeScrollerContent: {
    alignItems: "center",
    paddingRight: 6,
  },
  chartTypeItem: {
    height: 32,
    borderRadius: 12,
    marginLeft: 6,
  },
  chartTypeItemActive: {
    // no-op; variant controls appearance.
  },
  floatingFollowButton: {
    position: "absolute",
    bottom: 158,
    right: 44,
    height: 36,
    borderRadius: 12,
    borderBottomRightRadius: 0,
    paddingHorizontal: 14,
    zIndex: 10,
  },
  floatingTimer: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  floatingTimerDark: {},
  floatingTimerText: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1a9f7a",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: "hidden",
  },
  floatingTimerTextDark: {
    backgroundColor: "rgba(13, 15, 18, 0.85)",
  },
  topSafeArea: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: "stretch",
  },
  profitToast: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderColor: "#e6e6e6",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 6,
    overflow: "hidden",
  },

  startHintContainer: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    backgroundColor: "#1a9f7a",
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
    overflow: "hidden",
  },
  startHintContainerDark: {
    backgroundColor: "#1a9f7a",
  },
  startHintContent: {
    alignItems: "center",
    zIndex: 2,
  },
  startHintKicker: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(255, 255, 255, 0.8)",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  startHintKickerDark: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  startHintText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
  },
  startHintTextDark: {
    color: "#ffffff",
  },
  startHintCoins: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.9,
    zIndex: 1,
  },
  startHintCoin1: {
    position: "absolute",
    left: -8,
    top: -20,
  },
  startHintCoin2: {
    position: "absolute",
    right: -10,
    top: -15,
    transform: [{ rotate: "15deg" }],
  },
  startHintCoin3: {
    position: "absolute",
    right: 50,
    bottom: -24,
    transform: [{ rotate: "-10deg" }],
  },
  profitToastDark: {
    backgroundColor: "#151922",
    borderColor: "#2b2f35",
  },
  profitToastContent: {
    width: "100%",
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  profitToastKicker: {
    fontSize: 14,
    fontWeight: "800",
    color: "#8b9098",
    letterSpacing: 0.2,
    width: "100%",
    textAlign: "center",
  },
  profitToastKickerDark: {
    color: "#a9b0b8",
  },
  profitToastBigValue: {
    marginTop: 8,
    fontSize: 54,
    fontWeight: "800",
    color: "#1a9f7a",
    textAlign: "center",
  },
  profitToastBigValueLoss: {
    color: "#d94b4b",
  },
  profitToastBigValueFlat: {
    color: "#666666",
  },
  profitToastBigValueLiquidation: {
    color: "#b03030",
  },
  profitToastRocket: {
    position: "absolute",
    left: -24,
    bottom: -58,
    opacity: 0.95,
  },
  profitToastBanknote: {
    position: "absolute",
    left: -30,
    bottom: -62,
    opacity: 0.95,
    transform: [{ rotate: "-8deg" }],
  },
  profitToastBanknotes: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.95,
  },
  profitToastBanknote1: {
    position: "absolute",
    left: -10,
    bottom: -40,
  },
  profitToastBanknote2: {
    position: "absolute",
    left: 62,
    bottom: -30,
    transform: [{ rotate: "-10deg" }],
  },
  profitToastBanknote3: {
    position: "absolute",
    right: -24,
    bottom: -54,
    transform: [{ rotate: "12deg" }],
  },
  profitToastBanknote4: {
    position: "absolute",
    right: 34,
    bottom: -12,
    transform: [{ rotate: "-18deg" }],
  },
  profitToastBanknote5: {
    position: "absolute",
    left: 10,
    bottom: 10,
    transform: [{ rotate: "18deg" }],
  },
  profitToastCoins: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.95,
  },
  profitToastCoin1: {
    position: "absolute",
    left: -10,
    bottom: -40,
  },
  profitToastCoin2: {
    position: "absolute",
    left: 62,
    bottom: -30,
    transform: [{ rotate: "-10deg" }],
  },
  profitToastCoin3: {
    position: "absolute",
    right: -24,
    bottom: -54,
    transform: [{ rotate: "12deg" }],
  },
  profitToastCoin4: {
    position: "absolute",
    right: 34,
    bottom: -12,
    transform: [{ rotate: "-18deg" }],
  },
  profitToastCoin5: {
    position: "absolute",
    left: 10,
    bottom: 10,
    transform: [{ rotate: "18deg" }],
  },
  profitToastSkull: {
    position: "absolute",
    left: -20,
    bottom: -52,
    opacity: 0.92,
  },
  profitToastLossFace: {
    position: "absolute",
    left: -20,
    bottom: -52,
    opacity: 0.92,
  },
  bottomSafeArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    gap: TRADE_BAR_GAP,
  },
  wagerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 16,
    borderColor: "#e6e6e6",
  },
  wagerBarDark: {
    backgroundColor: "rgba(18,20,24,0.96)",
    borderColor: "#2b2f35",
  },
  wagerPicker: {
    flex: 1,
    height: 32,
  },
  wagerModeButton: {
    width: 112,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  wagerModeButtonControl: {
    width: "100%",
  },
  wagerModeButtonInactive: {
    backgroundColor: "transparent",
  },
  wagerModeButtonDark: {
    backgroundColor: "transparent",
  },
  wagerModeButtonInactiveDark: {
    backgroundColor: "transparent",
  },
  tradeBar: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: TRADE_BAR_GAP,
  },
  tradeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buyButton: {},
  shortButton: {},
  sellButton: {},
  shortButtonDisabled: {
    opacity: 0.5,
  },
  buyButtonDisabled: {
    opacity: 0.5,
  },
  sellButtonDisabled: {
    opacity: 0.5,
  },
});
