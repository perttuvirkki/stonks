import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ActionSheetIOS, Alert, Platform, StatusBar, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { Easing, useSharedValue, withTiming } from "react-native-reanimated";
import { BASE_PRICE, CANDLE_COUNT, HISTORY_COUNT, MAX_PRICE, MIN_PRICE, PATTERN_SPAWN_CHANCE, TICK_MS } from "./src/constants";
import { CHART_SCRIPT } from "./src/chartScript";
import { BottomControls } from "./src/components/BottomControls";
import { MarginCallOverlay, type MarginCallVariant } from "./src/components/MarginCallOverlay";
import { PatternBar } from "./src/components/PatternBar";
import { ProfitToast } from "./src/components/ProfitToast";
import { StackBar, type ChartType } from "./src/components/StackBar";
import TwemojiRocket from "./assets/twemoji/1f680.svg";
import TwemojiCoin from "./assets/twemoji/1fa99.svg";
import TwemojiBanknote from "./assets/twemoji/1f4b5.svg";
import TwemojiFreezingFace from "./assets/twemoji/1f976.svg";
import TwemojiHotFace from "./assets/twemoji/1f975.svg";
import TwemojiSkull from "./assets/twemoji/1f480.svg";
import type { ButtonVariant } from "./src/components/UiButton";
import { allPatterns, choosePattern } from "./src/patterns";
import type { Candle } from "./src/types";
import { createCandle, createTargetRunout } from "./src/utils";

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

const CHART_HTML = [
  "<!doctype html>",
  "<html>",
  "  <head>",
  '    <meta charset="utf-8" />',
  '    <meta name="viewport" content="width=device-width, initial-scale=1" />',
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
            rightPriceScale: { visible: true, autoScale: false },
            timeScale: { timeVisible: true, secondsVisible: false },
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
    if (ensureChart()) {
      post({ type: "ready" });
    }
    if (state.pending) {
      setData(state.pending);
    } else {
      showOverlay("Waiting for data...");
    }
  })();
  true;
`;

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const candleIndexRef = useRef(0);
  const baseTimeRef = useRef<number | null>(null);
  const [isWebReady, setIsWebReady] = useState(false);
  const [isChartFollowing, setIsChartFollowing] = useState(true);
  const [isMarginCallVisible, setIsMarginCallVisible] = useState(false);
  const [marginCallVariant, setMarginCallVariant] = useState<MarginCallVariant>("classic");
  const [tickMs, setTickMs] = useState(TICK_MS);
  const marginCallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWebReadyRef = useRef(false);
  const latestChartDataRef = useRef<ChartBar[]>([]);
  const patternLinesRef = useRef<PatternLineIndex[]>([]);
  const hasSentFullDataRef = useRef(false);
  const lastFullDataSendAtRef = useRef(0);
  const lineUpdateCounterRef = useRef(0);
  const [enabledPatternIds, setEnabledPatternIds] = useState<string[]>(() => allPatterns.map((pattern) => pattern.id));
  const enabledPatternIdsRef = useRef<string[]>(allPatterns.map((pattern) => pattern.id));
  const [chartType, setChartType] = useState<ChartType>("candles");
  const initialStackBalance = 10;
  const stackBalanceRef = useRef(initialStackBalance);
  const positionsRef = useRef<Position[]>([]);
  const [stackBalance, setStackBalance] = useState(initialStackBalance);
  const [useLeverage, setUseLeverage] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [leverageIndex, setLeverageIndex] = useState(1);
  const [tradeToast, setTradeToast] = useState<TradeToast | null>(null);
  const [rocketBurstTrigger, setRocketBurstTrigger] = useState(0);
  const toastTranslateY = useSharedValue(TOP_SHEET_OFFSET);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTradeLabelRef = useRef<string>("Trade");
  const leverageOption = LEVERAGE_OPTIONS[leverageIndex] ?? LEVERAGE_OPTIONS[0];
  const wagerPercent = leverageOption.percent;
  const wagerPercentUsed = useLeverage ? 1 : wagerPercent;
  const leverage = useLeverage ? leverageOption.leverage : 1;
  const wagerOptionLabels = useLeverage
    ? LEVERAGE_OPTIONS.map((option) => `${option.leverage}x`)
    : LEVERAGE_OPTIONS.map((option) => `${Math.round(option.percent * 100)}%`);
  const formatMoney = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const formatSignedMoney = (value: number) => {
    const absValue = Math.abs(value);
    const prefix = value > 0 ? "+$" : value < 0 ? "-$" : "$";
    return `${prefix}${formatMoney(absValue)}`;
  };
  const normalizeBalance = (value: number) => Math.max(0, Math.round(value));
  const wagerAmount = wagerPercentUsed === 1 ? stackBalance : Math.floor(stackBalance * wagerPercentUsed);
  const hasPositions = positionsRef.current.length > 0;
  const lockedSide = positionsRef.current[0]?.side ?? null;
  const canBuy = wagerAmount >= 1;
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
  const showTradeToast = (toast: TradeToast) => {
    setTradeToast(toast);
    // Rocket fly-by is the top/last profit tier.
    if (toast.kind === "profit" && toast.percent >= 500) {
      setRocketBurstTrigger(Date.now());
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
      toastTranslateY.value = withTiming(
        TOP_SHEET_OFFSET,
        {
          duration: 220,
          easing: Easing.in(Easing.cubic),
        }
      );
      toastHideTimeoutRef.current = setTimeout(() => {
        setTradeToast(null);
      }, 240);
    }, 2400);
  };
  const openSettings = () => {
    const options = darkMode ? ["Disable Dark Mode", "Cancel"] : ["Enable Dark Mode", "Cancel"];
    const onSelect = (index: number) => {
      if (index === 0) {
        setDarkMode((prev) => !prev);
      }
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: 1,
          userInterfaceStyle: darkMode ? "dark" : "light",
        },
        onSelect
      );
    } else {
      Alert.alert("Settings", "Dark mode", [
        { text: options[0], onPress: () => onSelect(0) },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const testRocketToast = () => {
    lastTradeLabelRef.current = "Test";
    showTradeToast({ kind: "profit", amount: 999, percent: 500 });
  };

  const pickMarginCallVariant = (): MarginCallVariant => {
    const roll = Math.random();
    if (roll < 0.34) return "incomingCall";
    if (roll < 0.67) return "breakingNews";
    return "classic";
  };

  const applyChartType = (nextType: ChartType) => {
    setChartType(nextType);
    webViewRef.current?.injectJavaScript(
      `window.__setChartType && window.__setChartType(${JSON.stringify(nextType)}); true;`
    );
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

    stackBalanceRef.current = initialStackBalance;
    setStackBalance(initialStackBalance);
    positionsRef.current = [];

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
  const handleBuy = (sideOverride?: "long" | "short") => {
    if (isMarginCallVisible) {
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
    const amount = wagerPercentUsed === 1 ? balance : Math.floor(balance * wagerPercentUsed);
    if (amount < 1) {
      return;
    }
    const positionSize = amount * leverage;
    const units = positionSize / price;
    const nextBalance = normalizeBalance(balance - amount);
    stackBalanceRef.current = nextBalance;
    positionsRef.current = [...positionsRef.current, { entryPrice: price, units, amount, side, leverage }];
    setStackBalance(nextBalance);
    sendPatternLines();
    const markerSide = useLeverage ? side : "buy";
    webViewRef.current?.injectJavaScript(`window.__addTrade && window.__addTrade("${markerSide}"); true;`);

    const labelSide = side === "short" ? "Short" : useLeverage ? "Long" : "Buy";
    const labelLev = useLeverage ? `${leverage}x` : "Spot";
    lastTradeLabelRef.current = useLeverage ? `${labelSide} ${labelLev}` : `${labelSide} | ${labelLev}`;
  };
  const handleSell = () => {
    if (isMarginCallVisible) {
      return;
    }
    const price = getCurrentPrice();
    if (!price || !Number.isFinite(price)) {
      return;
    }
    if (positionsRef.current.length === 0) {
      return;
    }
    const costBasis = positionsRef.current.reduce((sum, position) => sum + position.amount, 0);
    const proceeds = positionsRef.current.reduce((sum, position) => {
      const pnl = position.side === "long" ? (price - position.entryPrice) * position.units : (position.entryPrice - price) * position.units;
      return sum + position.amount + pnl;
    }, 0);
    const profit = proceeds - costBasis;
    const nextBalance = normalizeBalance(stackBalanceRef.current + proceeds);
    stackBalanceRef.current = nextBalance;
    positionsRef.current = [];
    setStackBalance(nextBalance);
    sendPatternLines();
    webViewRef.current?.injectJavaScript(`window.__addTrade && window.__addTrade("sell"); true;`);
    if (costBasis > 0) {
      const percent = (profit / costBasis) * 100;
      const kind = profit > 0 ? "profit" : profit < 0 ? "loss" : "flat";
      showTradeToast({ amount: profit, percent, kind });
    }
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
    const lines = patternLinesRef.current.map((line) => ({
      id: line.id,
      kind: line.kind,
      points: [
        { time: Math.floor(baseTime + line.startIndex * 60), value: line.startPrice },
        { time: Math.floor(baseTime + line.endIndex * 60), value: line.endPrice },
      ],
    }));
    const liquidation = getLiquidationPrice();
    if (liquidation) {
      lines.push({
        id: "liquidation-line",
        kind: "resistance",
        points: [
          { time: Math.floor(baseTime + firstIndex * 60), value: liquidation.price },
          { time: Math.floor(baseTime + lastIndex * 60), value: liquidation.price },
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
          const enabledIds = enabledPatternIdsRef.current;
          const pattern = choosePattern(lastClose, enabledIds);
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

      if (positionsRef.current.length) {
        const liquidation = getLiquidationPrice();
        if (liquidation) {
          const isLiquidated = liquidation.side === "long" ? bar.close <= liquidation.price : bar.close >= liquidation.price;
          if (isLiquidated) {
            const margin = positionsRef.current.reduce((sum, position) => sum + position.amount, 0);
            positionsRef.current = [];
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
      tradeToast.percent >= 500 ? null : tradeToast.percent >= 100 ? (
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
    <SafeAreaProvider>
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
          rocketBurstTrigger={tradeToast?.kind === "profit" && tradeToast.percent >= 500 ? rocketBurstTrigger : 0}
        />
        <StackBar
          stackBalance={stackBalance}
          formatMoney={formatMoney}
          useLeverage={useLeverage}
          leverage={leverage}
          wagerPercentUsed={wagerPercentUsed}
          wagerAmount={wagerAmount}
          darkMode={darkMode}
          isChartFollowing={isChartFollowing}
          chartType={chartType}
          resetChartView={resetChartView}
          setChartType={applyChartType}
          onTestRocketToast={testRocketToast}
          openSettings={openSettings}
          minorVariant={minorVariant}
          styles={styles}
        />
        <PatternBar
          patterns={allPatterns}
          enabledPatternIds={enabledPatternIds}
          togglePattern={togglePattern}
          darkMode={darkMode}
          majorVariant={majorVariant}
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
          <BottomControls
            darkMode={darkMode}
            useLeverage={useLeverage}
            toggleUseLeverage={() => setUseLeverage((prev) => !prev)}
            majorVariant={majorVariant}
            minorVariant={minorVariant}
            wagerOptionLabels={wagerOptionLabels}
            leverageIndex={leverageIndex}
            onSelectLeverageIndex={setLeverageIndex}
            hasPositions={hasPositions}
            primaryIsShort={primaryIsShort}
            primarySide={primarySide}
            canBuy={canBuy}
            canOpenLong={canOpenLong}
            canOpenShort={canOpenShort}
            onBuy={handleBuy}
            onSell={handleSell}
            styles={styles}
          />
        </View>
        <MarginCallOverlay visible={isMarginCallVisible} darkMode={darkMode} variant={marginCallVariant} onTryAgain={resetRun} />
      </SafeAreaView>
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
  followButton: {
    height: 32,
    borderRadius: 12,
  },
  followButtonDark: {
    // Intentionally no background override; UiButton variant controls it.
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
  patternBar: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    backgroundColor: "#ffffff",
    justifyContent: "center",
  },
  patternBarDark: {
    borderBottomColor: "#1f2329",
    backgroundColor: "#0d0f12",
  },
  patternRow: {
    paddingHorizontal: 12,
    alignItems: "center",
  },
  patternToggle: {
    marginRight: 8,
  },
  patternToggleDark: {
    backgroundColor: "transparent",
  },
  patternToggleActive: {
    backgroundColor: "transparent",
  },
  bottomSafeArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
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
