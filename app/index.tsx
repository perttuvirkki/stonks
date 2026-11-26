import { memo, type ComponentType, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import Animated, {
  Easing,
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  ReduceMotion,
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import * as StoreReview from "expo-store-review";
import { BASE_PRICE, CANDLE_COUNT, HISTORY_COUNT, MAX_PRICE, MIN_PRICE, PATTERN_SPAWN_CHANCE, TICK_MS } from "../src/constants";
import { CHART_SCRIPT } from "../src/chartScript";
import { BottomControls } from "../src/components/BottomControls";
import { AnimatedSplash } from "../src/components/AnimatedSplash";
import { MarginCallOverlay, type MarginCallVariant } from "../src/components/MarginCallOverlay";
import { EmojiText } from "../src/components/Twemoji";
import { PatternSettingsModal } from "../src/components/PatternSettingsModal";
import { ProFeaturesModal } from "../src/components/ProFeaturesModal";
import { TopScoreModal } from "../src/components/TopScoreModal";
import { TotalStatsModal } from "../src/components/TotalStatsModal";
import { ProfitToast } from "../src/components/ProfitToast";
import { RoundResultsSheet, type RoundResult, type RoundStats } from "../src/components/RoundResultsSheet";
import { StackBar, type ChartType } from "../src/components/StackBar";
import { RocketBurst } from "../src/components/RocketBurst";
import { RoundTimer } from "../src/components/RoundTimer";
import { popIn } from "../src/transitions";
import {
  EMPTY_QUIZ_SCORE,
  PopQuizCard,
  PopQuizScoreTag,
  isQuizAnswerCorrect,
  type QuizPrompt,
  type QuizScore,
  type QuizSide,
} from "../src/components/PopQuizCard";
import { RevenueCatProvider, useRevenueCat } from "../src/contexts/RevenueCatContext";
import { useGameStore } from "../src/stores/useGameStore";
import { getDailyMoneyQuote } from "../src/data/dailyMoneyQuotes";
import TwemojiRocket from "../assets/twemoji/1f680.svg";
import TwemojiTrophy from "../assets/twemoji/1f3c6.svg";
import TwemojiBarChart from "../assets/twemoji/1f4ca.svg";
import TwemojiChartUp from "../assets/twemoji/1f4c8.svg";
import TwemojiMoneyBag from "../assets/twemoji/1f4b0.svg";
import TwemojiCoin from "../assets/twemoji/1fa99.svg";
import TwemojiWheel from "../assets/twemoji/1f6de.svg";
import TwemojiBanknote from "../assets/twemoji/1f4b5.svg";
import TwemojiLock from "../assets/twemoji/1f512.svg";
import TwemojiStar from "../assets/twemoji/2b50.svg";
import TwemojiMoon from "../assets/twemoji/1f319.svg";
import TwemojiRestore from "../assets/twemoji/1f504.svg";
import TwemojiWrench from "../assets/twemoji/1f527.svg";
import TwemojiFreezingFace from "../assets/twemoji/1f976.svg";
import TwemojiHotFace from "../assets/twemoji/1f975.svg";
import TwemojiSkull from "../assets/twemoji/1f480.svg";
import TwemojiTarget from "../assets/twemoji/1f3af.svg";
import TwemojiMedal from "../assets/twemoji/1f3c5.svg";
import type { ButtonVariant } from "../src/components/UiButton";
import { UiButton } from "../src/components/UiButton";
import { getReadableTextOn } from "../src/components/uiColors";
import { TERMINAL_DARK, TERMINAL_FONT, TERMINAL_LIGHT, getTerminalPalette } from "../src/theme/terminal";
import { allPatterns, choosePattern } from "../src/patterns";
import type { Candle, PatternLineKind } from "../src/types";
import { createCandle } from "../src/utils";
import * as GameCenter from "../src/services/GameCenterService";
import { allTimeNetProfit, compoundTrainingReturn, progressFor, type ProgressEvent } from "../src/progress";

type ChartBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type PatternLineIndex = {
  id: string;
  kind: PatternLineKind;
  /** Anchor points in absolute candle indices. */
  points: { index: number; price: number }[];
  revealIndex: number;
  /** Last candle index the line extends to. */
  endIndex: number;
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

type LaunchScreen = "menu" | "dailyQuote" | "settings" | "game";
type NavigationDirection = "initial" | "forward" | "back";
type GameMode = "sprint60" | "fiveTrades" | "training" | "quiz";

const CHART_BOTTOM_INSET = 110;
const TOP_SHEET_OFFSET = -240;
const TRADE_SHEET_DETENTS = [0.18];
const TRADE_BAR_GAP = 12;
const TRADE_CONTROLS_MAX_WIDTH = 560;
const LAUNCH_MENU_HEADER_HEIGHT = 44;
const QUOTE_ROLL_WIDTH = 16;
// The reveal starts this far left of the paper so its drop shadow is hidden too.
const QUOTE_ROLL_START_X = -14;
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
const FIVE_TRADES_TARGET = 5;
type SettingsRow = {
  id: string;
  label: string;
  subtitle: string;
  icon: ComponentType<{ width?: number | string; height?: number | string }>;
  onPress: () => void;
};

type SettingsSection = {
  id: string;
  title: string;
  rows: SettingsRow[];
};

/** Milliseconds per candle. Lower is faster. */
type ChartSpeedMs = number;
const SPEED_MIN_MS = 25;
const SPEED_MAX_MS = 250;
const SPEED_STEP_MS = 25;
const clampSpeedMs = (ms: number) => Math.min(SPEED_MAX_MS, Math.max(SPEED_MIN_MS, Math.round(ms / SPEED_STEP_MS) * SPEED_STEP_MS));

// Estimate used for UI messaging (pattern length + typical resolve/spawn overhead).
const ESTIMATED_CANDLES_PER_PATTERN_CYCLE = 80;
const SPEED_HINT_DURATION_MS = 1600;

const getLocalDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const CHART_HTML = [
  "<!doctype html>",
  "<html>",
  "  <head>",
  '    <meta charset="utf-8" />',
  '    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />',
  "    <style>",
  "      html, body { width: 100%; height: 100%; margin: 0; padding: 0; }",
  "      body { background: #f7f6f2; font-family: Menlo, Consolas, 'Courier New', monospace; overflow: hidden; }",
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
	    var FOLLOW_RIGHT_OFFSET_BARS = 6;
	    var PRICE_ZOOM_OUT_MULTIPLIER = 1.5;
	    var DEFAULT_ZOOM_PRESET = 2;

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
	        initialPriceSpan: null,
	        defaultZoomPreset: DEFAULT_ZOOM_PRESET,
	        didApplyDefaultZoom: false,
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
	    if (!("initialPriceSpan" in state)) {
	      state.initialPriceSpan = null;
	    }
	    if (!("defaultZoomPreset" in state)) {
	      state.defaultZoomPreset = DEFAULT_ZOOM_PRESET;
	    }
	    if (!("didApplyDefaultZoom" in state)) {
	      state.didApplyDefaultZoom = false;
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
	      state.lastManualInteractionAt = Date.now();
	      if (state.autoFollowTimer) {
	        clearTimeout(state.autoFollowTimer);
	        state.autoFollowTimer = null;
	      }
	      // Auto-follow after the user stops interacting for a moment, but only if they're still near the right edge.
	      state.autoFollowTimer = setTimeout(function () {
	        try {
	          if (!state || state.follow) return;
	          var lastAt = Number(state.lastManualInteractionAt || 0);
	          if (!isFinite(lastAt) || Date.now() - lastAt < 500) return;
	          maybeEnableFollow("auto");
	        } catch (e) {
	          // Ignore.
	        }
	      }, 520);
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

	    function maybeEnableFollow(source) {
	      if (!ensureChart()) {
	        return;
	      }
	      if (state.follow) {
	        return;
	      }
	      var timeScale = state.chart && state.chart.timeScale && state.chart.timeScale();
	      if (!timeScale || typeof timeScale.getVisibleRange !== "function") {
	        return;
	      }
	      var last = getLastBar();
	      if (!last || !isFinite(Number(last.time))) {
	        return;
	      }
	      var range = timeScale.getVisibleRange();
	      if (!range || !isFinite(Number(range.from)) || !isFinite(Number(range.to))) {
	        return;
	      }
	      var from = Math.min(Number(range.from), Number(range.to));
	      var to = Math.max(Number(range.from), Number(range.to));
	      var lastTime = Number(last.time);
	      var step = getBarStepSeconds(state.pending);
	      // Consider "near right edge" if the latest bar is still visible and close to the right side.
	      var visible = lastTime >= from && lastTime <= to + step * 2;
	      var nearRight = lastTime >= to - step * (FOLLOW_RIGHT_OFFSET_BARS + 8);
	      if (!visible || !nearRight) {
	        return;
	      }
	      state.follow = true;
	      if (state.autoFollowTimer) {
	        clearTimeout(state.autoFollowTimer);
	        state.autoFollowTimer = null;
	      }
	      followToLastBar();
	      post({ type: "debug", message: "follow:on:" + (source || "auto") });
	    }

	    function followToLastBar() {
	      if (!state.chart || !state.chart.timeScale) {
	        return;
	      }
	      var timeScale = state.chart.timeScale();
      if (timeScale && typeof timeScale.applyOptions === "function") {
        // Keep a small space to the right of the latest bar while following.
        timeScale.applyOptions({ rightOffset: FOLLOW_RIGHT_OFFSET_BARS });
      }
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
              // Keep a reasonable minimum to avoid an overly-dense x-axis when using zoom presets.
              minBarSpacing: 0.5,
              // Keep a small right padding (in bars) so the latest candle isn't flush to the edge.
              rightOffset: FOLLOW_RIGHT_OFFSET_BARS,
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
	                  // If this is a pinch (multi-touch), keep follow enabled and let the chart handle zoom.
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
      // Wide screens (iPad, an unfolded iPhone Duo) get proportionally wider candles so the
      // same history fills the chart instead of bunching up on the right.
      if (state.zoomBaseBarSpacing && state.zoomFactor) {
        state.chart.timeScale().applyOptions({ barSpacing: Math.max(0.5, (state.zoomBaseBarSpacing * widthBarScale()) / state.zoomFactor) });
      }
    }
    function widthBarScale() {
      var width = container.clientWidth || window.innerWidth;
      return Math.max(1, width / 390);
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
	        if (state.initialPriceSpan === null) {
	          var initialPriceRange = getCurrentVisiblePriceRange();
	          if (initialPriceRange && isFinite(initialPriceRange.from) && isFinite(initialPriceRange.to)) {
	            var initialPriceSpan = Number(initialPriceRange.to) - Number(initialPriceRange.from);
	            if (isFinite(initialPriceSpan) && initialPriceSpan > 0) {
	              state.initialPriceSpan = initialPriceSpan;
	            }
	          }
	        }
	        if (!state.didApplyDefaultZoom && state.defaultZoomPreset && window.__setZoomOutPreset) {
	          try {
	            window.__setZoomOutPreset(state.defaultZoomPreset);
	          } catch (e) {
	            // Ignore.
	          }
	          state.didApplyDefaultZoom = true;
	        }
	        if (state.follow) {
	          followToLastBar();
	        }
      } else if (state.follow) {
        followToLastBar();
      }
    }
    var LINE_STYLES = {
      support: { color: "#1a9f7a", lineWidth: 2, lineStyle: 0 },
      resistance: { color: "#d94b4b", lineWidth: 2, lineStyle: 0 },
      neckline: { color: "#3b82f6", lineWidth: 2, lineStyle: 0 },
      target: { color: "#f5a524", lineWidth: 2, lineStyle: 2, lastValueVisible: true, title: "Target" },
      guide: { color: "#9aa0a6", lineWidth: 1, lineStyle: 1 },
    };
    function ensureLineSeries(key, kind) {
      if (!state.chart) {
        return null;
      }
      if (!state.lineSeries) {
        state.lineSeries = {};
      }
      if (state.lineSeries[key]) {
        return state.lineSeries[key];
      }
      var style = LINE_STYLES[kind] || LINE_STYLES.support;
      var options = {
        color: style.color,
        lineWidth: style.lineWidth,
        lineStyle: style.lineStyle,
        priceLineVisible: false,
        lastValueVisible: !!style.lastValueVisible,
        title: style.title || "",
        crosshairMarkerVisible: false,
        pointMarkersVisible: false,
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
      state.lineSeries[key] = series;
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
        // Key by id and kind so a reused id never keeps a stale colour.
        var kind = line.kind || "support";
        var key = line.id + ":" + kind;
        active[key] = true;
        var series = ensureLineSeries(key, kind);
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
    // The liquidation level is a price line on the main series: full width, labelled on the
    // axis, and (unlike a line series) it never stretches the time scale.
    function applyLiquidationLine() {
      if (state.liqLine && state.liqLineSeries) {
        try {
          state.liqLineSeries.removePriceLine(state.liqLine);
        } catch (e) {
          // Series already gone.
        }
      }
      state.liqLine = null;
      state.liqLineSeries = null;
      var price = state.liqPrice;
      if (!state.series || typeof state.series.createPriceLine !== "function" || typeof price !== "number" || !isFinite(price)) {
        return;
      }
      state.liqLine = state.series.createPriceLine({
        price: price,
        color: "#d94b4b",
        lineWidth: 2,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Liq",
      });
      state.liqLineSeries = state.series;
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
    window.__setLiquidationLine = function (price) {
      if (!ensureChart()) {
        return;
      }
      var next = price === null || price === undefined ? null : Number(price);
      if (next === state.liqPrice && state.liqLineSeries === state.series && (next === null || state.liqLine)) {
        return;
      }
      state.liqPrice = next;
      applyLiquidationLine();
    };

    window.__setChartType = function (type) {
      try {
        if (!ensureChart()) {
          return;
        }
        ensurePriceSeries(type);
        applyLiquidationLine();
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
        if (typeof state.initialBarSpacing === "number" && isFinite(state.initialBarSpacing)) {
          resetOptions.barSpacing = state.initialBarSpacing;
        }
        if (typeof state.initialRightOffset === "number" && isFinite(state.initialRightOffset)) {
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

    window.__setZoomOutPreset = function (preset) {
      if (!ensureChart()) {
        return;
      }
      if (!state.chart || !state.chart.timeScale) {
        return;
      }
      var timeScale = state.chart.timeScale();
      if (!timeScale || typeof timeScale.applyOptions !== "function") {
        return;
      }
      var level = Number(preset);
      var zoomFactor = null;
      if (level === 1) zoomFactor = 1;
      if (level === 2) zoomFactor = 2;
      if (level === 3) zoomFactor = 3;
      if (!isFinite(zoomFactor) || zoomFactor <= 0) {
        return;
      }
      // X axis: use initial bar spacing as baseline if available.
      var baseBarSpacing = null;
      if (typeof state.initialBarSpacing === "number" && isFinite(state.initialBarSpacing)) {
        baseBarSpacing = state.initialBarSpacing;
      } else if (typeof timeScale.options === "function") {
        var opts = timeScale.options();
        if (opts && typeof opts.barSpacing === "number" && isFinite(opts.barSpacing)) {
          baseBarSpacing = opts.barSpacing;
        }
      }
      if (typeof baseBarSpacing === "number" && isFinite(baseBarSpacing) && baseBarSpacing > 0) {
        // Only adjust bar spacing; do not also widen the visible time range, as that compounds the zoom-out
        // effect and makes the time scale overly dense.
        state.zoomBaseBarSpacing = baseBarSpacing;
        state.zoomFactor = zoomFactor;
        var nextBarSpacing = (baseBarSpacing * widthBarScale()) / zoomFactor;
        nextBarSpacing = Math.max(0.5, nextBarSpacing);
        timeScale.applyOptions({ barSpacing: nextBarSpacing });
      }

      try {
        // Y axis: widen the visible price range around the latest close.
        var ps = getPriceScaleApi();
        if (ps && typeof ps.setVisibleRange === "function") {
          var priceRange = getCurrentVisiblePriceRange();
          var lastBar = getLastBar();
          if (!lastBar && Array.isArray(state.pending) && state.pending.length) {
            lastBar = state.pending[state.pending.length - 1];
          }
          var center = lastBar && isFinite(Number(lastBar.close)) ? Number(lastBar.close) : null;
          if (!center && priceRange) {
            center = (priceRange.from + priceRange.to) / 2;
          }
          if (priceRange && isFinite(center)) {
            var priceSpanBase = null;
            if (typeof state.initialPriceSpan === "number" && isFinite(state.initialPriceSpan)) {
              priceSpanBase = state.initialPriceSpan;
            } else {
              priceSpanBase = Number(priceRange.to) - Number(priceRange.from);
            }
            if (typeof priceSpanBase === "number" && isFinite(priceSpanBase) && priceSpanBase > 0) {
              var nextSpan = priceSpanBase * zoomFactor * PRICE_ZOOM_OUT_MULTIPLIER;
              var half = nextSpan / 2;
              try {
                if (typeof ps.setAutoScale === "function") {
                  ps.setAutoScale(false);
                }
              } catch (e) {
                // Ignore.
              }
              ps.setVisibleRange({ from: center - half, to: center + half });
            }
          }
        }
      } catch (e) {
        // Ignore.
      }

      post({ type: "debug", message: "zoomOutPreset:" + level + ":factor:" + zoomFactor });
    };

	    window.__enableFollow = function () {
	      if (!ensureChart()) {
	        return;
	      }
	      state.follow = true;
	      if (state.autoFollowTimer) {
	        clearTimeout(state.autoFollowTimer);
	        state.autoFollowTimer = null;
	      }
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
              fontFamily: theme.fontFamily || undefined,
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
          if (theme.fontFamily) {
            overlay.style.fontFamily = theme.fontFamily;
          }
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { isPro: isProReal, proPrice, purchasePro, restorePurchases, isLoading: isRevenueCatLoading } = useRevenueCat();
  const [debugProOverride, setDebugProOverride] = useState(false);
  const isPro = isProReal || debugProOverride; // Debug override for testing
  const addScore = useGameStore((state) => state.addScore);
  const recordRoundEnd = useGameStore((state) => state.recordRoundEnd);
  const recordTrade = useGameStore((state) => state.recordTrade);
  // Leaderboards and achievements. Reads the store directly so timers and stale closures
  // always see the latest lifetime stats and unlocked achievements.
  const reportProgress = (event: ProgressEvent) => {
    const { unlockedAchievements, markAchievementsUnlocked } = useGameStore.getState();
    void GameCenter.reportProgress(progressFor(event), unlockedAchievements).then((keys) => {
      if (keys.length) {
        markAchievementsUnlocked(keys);
      }
    });
  };
  const lifetimeNetProgress = () => {
    const stats = useGameStore.getState().lifetimeStats;
    return { netProfit: allTimeNetProfit(stats), totalRounds: stats.totalRounds };
  };
  const resetTrainingSession = () => {
    trainingReturnRef.current = 0;
    setTrainingReturn(0);
    setTrainingTally({ trades: 0, wins: 0 });
  };
  /** Fold one closed (or liquidated) training trade into the session score. */
  const recordTrainingTrade = (profit: number) => {
    const stack = stackBalanceRef.current;
    const next = compoundTrainingReturn(trainingReturnRef.current, profit, stack);
    trainingReturnRef.current = next;
    setTrainingReturn(next);
    setTrainingTally((prev) => ({ trades: prev.trades + 1, wins: prev.wins + (profit > 0 ? 1 : 0) }));
    reportProgress({ type: "tradeClosed", training: true, profit, trainingReturnPercent: next });
  };
  const recordLeverageUse = useGameStore((state) => state.recordLeverageUse);
  const lifetimeRounds = useGameStore((state) => state.lifetimeStats.totalRounds);
  const quoteStackBonusTotal = useGameStore((state) => state.quoteStackBonusTotal);
  const quotePendingProBonus = useGameStore((state) => state.quotePendingProBonus);
  const dailyQuoteLastClaimDayKey = useGameStore((state) => state.dailyQuoteLastClaimDayKey);
  const claimDailyQuoteBonus = useGameStore((state) => state.claimDailyQuoteBonus);
  const releasePendingProQuoteBonus = useGameStore((state) => state.releasePendingProQuoteBonus);
  const reviewPromptShown = useGameStore((state) => state.reviewPromptShown);
  const setReviewPromptShown = useGameStore((state) => state.setReviewPromptShown);
  const webViewRef = useRef<WebView>(null);
  const candleIndexRef = useRef(0);
  const baseTimeRef = useRef<number | null>(null);
  const [isWebReady, setIsWebReady] = useState(false);
  // Show our custom splash immediately so Android doesn't briefly flash the game UI before the animation.
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [launchScreen, setLaunchScreen] = useState<LaunchScreen>("menu");
  const [navigationDirection, setNavigationDirection] = useState<NavigationDirection>("initial");
  const isScreenTransitioningRef = useRef(false);
  const screenTransitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gameMode, setGameMode] = useState<GameMode>("sprint60");
  const gameModeRef = useRef<GameMode>("sprint60");
  const [isRoundActive, setIsRoundActive] = useState(false);
  const [roundTradesMade, setRoundTradesMade] = useState(0);
  const dailyMoneyQuote = useMemo(() => getDailyMoneyQuote(), []);
  const isNarrowScreen = windowWidth < 380;
  const isCompactHeight = windowHeight < 760;
  const launchMenuButtonMinHeight = Math.max(96, (windowHeight - insets.top - insets.bottom - LAUNCH_MENU_HEADER_HEIGHT) / 6);
  const dailyQuoteFontSize = dailyMoneyQuote.text.length > 300 ? 14 : dailyMoneyQuote.text.length > 200 ? 17 : dailyMoneyQuote.text.length > 140 ? 21 : dailyMoneyQuote.text.length > 90 ? 25 : dailyMoneyQuote.text.length > 65 ? 29 : isNarrowScreen ? 31 : 35;
  const dailyQuoteLineHeight = Math.round(dailyQuoteFontSize * 1.2);
  const dailyMoneyDateLine = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).toUpperCase(),
    []
  );
  const todayDayKey = getLocalDayKey();
  const canClaimDailyQuote = dailyQuoteLastClaimDayKey !== todayDayKey;
  const [isChartFollowing, setIsChartFollowing] = useState(true);

  const [isMarginCallVisible, setIsMarginCallVisible] = useState(false);
  const isMarginCallVisibleRef = useRef(false);
  const [isTopScoreVisible, setIsTopScoreVisible] = useState(false);
  const [isTotalStatsVisible, setIsTotalStatsVisible] = useState(false);
  const [marginCallVariant, setMarginCallVariant] = useState<MarginCallVariant>("classic");
  const [baseTickMs, setBaseTickMs] = useState<ChartSpeedMs>(TICK_MS);
  const baseTickMsRef = useRef<number>(TICK_MS);
  const [tickMs, setTickMs] = useState(TICK_MS);
  const marginCallTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRoundResultsVisible, setIsRoundResultsVisible] = useState(false);
  const [isRoundEnded, setIsRoundEnded] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);
  const isOvertimeRef = useRef(false);
  const isRoundResultsVisibleRef = useRef(false);
  const [roundResult, setRoundResult] = useState<RoundResult | null>(null);
  const [roundSecondsRemaining, setRoundSecondsRemaining] = useState<number | null>(null);
  const [isPatternSettingsVisible, setIsPatternSettingsVisible] = useState(false);
  const [currentPatternLabel, setCurrentPatternLabel] = useState<string | null>(null);
  const roundEndsAtRef = useRef<number | null>(null);
  const roundStartedAtRef = useRef<number | null>(null);
  const roundModeRef = useRef<GameMode>("sprint60");
  const roundStartNetWorthRef = useRef(0);
  const roundStatsRef = useRef<RoundStats>({
    tradesMade: 0,
    tradesWon: 0,
    tradesLost: 0,
    biggestWinPercent: 0,
    biggestLossPercent: 0,
    longestTrade: 0,
    closestToLiquidation: 100,
  });
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
  const [zoomPreset, setZoomPreset] = useState<1 | 2 | 3>(2);
  const baseInitialStackBalance = isPro ? 200 : 100;
  const initialStackBalance = baseInitialStackBalance + quoteStackBonusTotal;
  const stackBalanceRef = useRef(initialStackBalance);
  const positionsRef = useRef<Position[]>([]);
  const [positionCount, setPositionCount] = useState(0); // Track position count for re-renders
  const [stackBalance, setStackBalance] = useState(initialStackBalance);
  const previousInitialStackBalanceRef = useRef(initialStackBalance);

  useEffect(() => {
    baseTickMsRef.current = baseTickMs;
  }, [baseTickMs]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    isOvertimeRef.current = isOvertime;
  }, [isOvertime]);
  const [useLeverage, setUseLeverage] = useState(true);
  const darkModePreference = useGameStore((state) => state.darkMode);
  // Dark terminal is a Pro feature: a lapsed or restored-on-another-device
  // preference never applies without Pro.
  const darkMode = isPro && darkModePreference;
  const terminal = getTerminalPalette(darkMode);
  const setDarkMode = useGameStore((state) => state.setDarkMode);
  const [leverageIndex, setLeverageIndex] = useState(1);
  const [tradeToast, setTradeToast] = useState<TradeToast | null>(null);
  const [showStartHint, setShowStartHint] = useState(false);
  const [showSpeedHint, setShowSpeedHint] = useState(false);
  const [isInGameBannerDismissed, setIsInGameBannerDismissed] = useState(false);
  const [speedHintText, setSpeedHintText] = useState<string>("");
  const speedHintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overtimeBurstTrigger, setOvertimeBurstTrigger] = useState(0);
  const [overtimeBannerLayout, setOvertimeBannerLayout] = useState({ width: 0, height: 0 });
  const [showPatternLines, setShowPatternLines] = useState(false);
  const showPatternLinesRef = useRef(false);
  // Pop Quiz: the chart halts when a pattern finishes forming and asks long or short.
  const [quizPrompt, setQuizPrompt] = useState<QuizPrompt | null>(null);
  const [quizScore, setQuizScore] = useState<QuizScore>(EMPTY_QUIZ_SCORE);
  const quizPendingRef = useRef<Omit<QuizPrompt, "answer"> | null>(null);
  const quizPausedRef = useRef(false);
  const quizRevealLinesRef = useRef(false);
  const quizIdRef = useRef(0);
  // Training Wheels: no money moves, the session is scored as a compounded % return instead.
  const [trainingReturn, setTrainingReturn] = useState(0);
  const trainingReturnRef = useRef(0);
  const [trainingTally, setTrainingTally] = useState({ trades: 0, wins: 0 });
  const [rocketBurstTrigger, setRocketBurstTrigger] = useState(0);
  const [moneyPrinterTrigger, setMoneyPrinterTrigger] = useState(0);
  const toastTranslateY = useSharedValue(TOP_SHEET_OFFSET);
  const quoteCashDropProgress = useSharedValue(0);
  const quotePaperProgress = useSharedValue(1);
  const quoteHeadlineProgress = useSharedValue(1);
  const quoteBylineProgress = useSharedValue(1);
  const quotePaperShake = useSharedValue(0);
  const quotePaperWidth = useSharedValue(0);
  const quoteStackFlash = useSharedValue(0);
  const quoteCursorOpacity = useSharedValue(1);
  const [quoteStackDisplay, setQuoteStackDisplay] = useState<number | null>(null);
  const quoteStackCountFrameRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTradeLabelRef = useRef<string>("Trade");
  const [isProFeaturesVisible, setIsProFeaturesVisible] = useState(false);
  const didTryReviewPromptRef = useRef(false);

  const navigateTo = useCallback(
    (nextScreen: LaunchScreen, direction: Exclude<NavigationDirection, "initial">) => {
      if (nextScreen === launchScreen || isScreenTransitioningRef.current) {
        return false;
      }

      isScreenTransitioningRef.current = true;
      setNavigationDirection(direction);
      setLaunchScreen(nextScreen);

      if (screenTransitionTimeoutRef.current) {
        clearTimeout(screenTransitionTimeoutRef.current);
      }
      screenTransitionTimeoutRef.current = setTimeout(() => {
        isScreenTransitioningRef.current = false;
        screenTransitionTimeoutRef.current = null;
      }, 300);
      return true;
    },
    [launchScreen],
  );

  const screenEntering = useMemo(() => {
    const animation =
      navigationDirection === "forward" ? FadeInRight : navigationDirection === "back" ? FadeInLeft : FadeIn;
    return animation.duration(navigationDirection === "initial" ? 180 : 260).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
  }, [navigationDirection]);

  // Every secondary screen is a child of the menu, so its only exit is a back transition.
  // Keeping the exit animation tied to the current screen also lets Reanimated finish it after unmount.
  const screenExiting = useMemo(() => {
    const animation = launchScreen === "menu" ? FadeOutLeft : FadeOutRight;
    return animation.duration(200).easing(Easing.in(Easing.cubic)).reduceMotion(ReduceMotion.System);
  }, [launchScreen]);

  useEffect(
    () => () => {
      if (screenTransitionTimeoutRef.current) {
        clearTimeout(screenTransitionTimeoutRef.current);
      }
    },
    [],
  );

  const quoteCashDropStyle1 = useAnimatedStyle(() => {
    const raw = quoteCashDropProgress.value / 0.78;
    const p = Math.min(Math.max(raw, 0), 1);
    const fadeIn = p < 0.18 ? p / 0.18 : 1;
    const fadeOut = p > 0.82 ? (1 - p) / 0.18 : 1;
    const opacity = Math.max(0, Math.min(fadeIn, fadeOut));

    return {
      opacity,
      transform: [{ translateY: -92 + p * 92 }, { translateX: -24 * (1 - p) }, { scale: 0.82 + p * 0.18 }],
    };
  });

  const quoteCashDropStyle2 = useAnimatedStyle(() => {
    const raw = (quoteCashDropProgress.value - 0.1) / 0.74;
    const p = Math.min(Math.max(raw, 0), 1);
    const fadeIn = p < 0.18 ? p / 0.18 : 1;
    const fadeOut = p > 0.82 ? (1 - p) / 0.18 : 1;
    const opacity = Math.max(0, Math.min(fadeIn, fadeOut));

    return {
      opacity,
      transform: [{ translateY: -100 + p * 100 }, { translateX: 0 }, { scale: 0.82 + p * 0.18 }],
    };
  });

  const quoteCashDropStyle3 = useAnimatedStyle(() => {
    const raw = (quoteCashDropProgress.value - 0.2) / 0.68;
    const p = Math.min(Math.max(raw, 0), 1);
    const fadeIn = p < 0.18 ? p / 0.18 : 1;
    const fadeOut = p > 0.82 ? (1 - p) / 0.18 : 1;
    const opacity = Math.max(0, Math.min(fadeIn, fadeOut));

    return {
      opacity,
      transform: [{ translateY: -108 + p * 108 }, { translateX: 24 * (1 - p) }, { scale: 0.82 + p * 0.18 }],
    };
  });

  const quotePaperStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 3 * quotePaperShake.value }],
  }));

  // Roll-open reveal: a background-coloured cover slides off to the right (hiding the paper and
  // its shadow) while a paper roll rides its left edge.
  const quotePaperCoverStyle = useAnimatedStyle(() => {
    const p = quotePaperProgress.value;
    return {
      opacity: p >= 1 ? 0 : 1,
      transform: [{ translateX: QUOTE_ROLL_START_X + p * (quotePaperWidth.value - QUOTE_ROLL_START_X) }],
    };
  });

  const quotePaperRollStyle = useAnimatedStyle(() => {
    const p = quotePaperProgress.value;
    const fadeOut = p > 0.85 ? Math.max(0, (1 - p) / 0.15) : 1;
    return {
      opacity: fadeOut,
      transform: [
        { translateX: QUOTE_ROLL_START_X + p * (quotePaperWidth.value - QUOTE_ROLL_START_X) - QUOTE_ROLL_WIDTH / 2 },
        { scaleX: 0.4 + 0.6 * fadeOut },
      ],
    };
  });

  const quoteHeadlineStyle = useAnimatedStyle(() => ({
    opacity: quoteHeadlineProgress.value,
    transform: [{ translateY: 10 * (1 - quoteHeadlineProgress.value) }],
  }));

  const quoteBylineStyle = useAnimatedStyle(() => ({
    opacity: quoteBylineProgress.value,
    transform: [{ translateY: 6 * (1 - quoteBylineProgress.value) }],
  }));

  const quoteStackValueStyle = useAnimatedStyle(() => ({
    color: interpolateColor(quoteStackFlash.value, [0, 1], [terminal.text, terminal.green]),
  }));

  const quoteCursorStyle = useAnimatedStyle(() => ({
    opacity: quoteCursorOpacity.value,
  }));

  // Daily Quote juice: the paper rolls open from the left, then the headline and byline reveal.
  useEffect(() => {
    if (launchScreen !== "dailyQuote") {
      cancelAnimation(quoteCursorOpacity);
      return;
    }
    quotePaperProgress.value = 0;
    quoteHeadlineProgress.value = 0;
    quoteBylineProgress.value = 0;
    quotePaperShake.value = 0;
    quoteStackFlash.value = 0;
    quotePaperProgress.value = withDelay(120, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    quoteHeadlineProgress.value = withDelay(620, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    quoteBylineProgress.value = withDelay(770, withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) }));
    quoteCursorOpacity.value = 1;
    quoteCursorOpacity.value = withRepeat(
      withSequence(withDelay(530, withTiming(0, { duration: 0 })), withDelay(530, withTiming(1, { duration: 0 }))),
      -1,
    );
    // Only re-run when the screen is entered, not when the claim state changes mid-screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [launchScreen]);

  useEffect(
    () => () => {
      if (quoteStackCountFrameRef.current != null) {
        cancelAnimationFrame(quoteStackCountFrameRef.current);
      }
    },
    [],
  );

  const formatPatternsPerMinute = useCallback((ms: number): string => {
    const ppm = 60_000 / (ms * ESTIMATED_CANDLES_PER_PATTERN_CYCLE);
    return `~${ppm.toFixed(1)} patterns/min`;
  }, []);

  const setChartSpeedMs = useCallback(
    (next: ChartSpeedMs) => {
      const didChange = baseTickMsRef.current !== next;
      setBaseTickMs(next);
      setTickMs((current) => (current === baseTickMsRef.current ? next : current));

      if (didChange && !isRoundActive) {
        if (speedHintTimeoutRef.current) {
          clearTimeout(speedHintTimeoutRef.current);
          speedHintTimeoutRef.current = null;
        }
        setShowStartHint(false);
        setSpeedHintText(formatPatternsPerMinute(next));
        setShowSpeedHint(true);
        speedHintTimeoutRef.current = setTimeout(() => {
          setShowSpeedHint(false);
        }, SPEED_HINT_DURATION_MS);
      }
    },
    [formatPatternsPerMinute, isRoundActive],
  );

  useEffect(() => {
    if (isRoundActive && showSpeedHint) {
      setShowSpeedHint(false);
      if (speedHintTimeoutRef.current) {
        clearTimeout(speedHintTimeoutRef.current);
        speedHintTimeoutRef.current = null;
      }
    }
  }, [isRoundActive, showSpeedHint]);

  useEffect(() => {
    const hasOvertimeBanner = isOvertime && positionCount > 0 && !isRoundResultsVisible && !isMarginCallVisible;
    if (!showStartHint && !showSpeedHint && !hasOvertimeBanner) {
      setIsInGameBannerDismissed(false);
    }
  }, [showStartHint, showSpeedHint, isOvertime, positionCount, isRoundResultsVisible, isMarginCallVisible]);

  useEffect(() => {
    const previousInitial = previousInitialStackBalanceRef.current;
    if (previousInitial === initialStackBalance) {
      return;
    }

    if (!positionsRef.current.length && !isRoundActive && !isRoundResultsVisible && !isMarginCallVisible) {
      stackBalanceRef.current = initialStackBalance;
      setStackBalance(initialStackBalance);
    }
    previousInitialStackBalanceRef.current = initialStackBalance;
  }, [initialStackBalance, isMarginCallVisible, isRoundActive, isRoundResultsVisible]);

  useEffect(() => {
    // Top up balance if user becomes Pro and hasn't started trading yet (simple check)
    // or just let them enjoy it on next round.
    // If they buy Pro before trading, top up the start stack.
    const nonProInitial = 100 + quoteStackBonusTotal;
    const proInitial = 200 + quoteStackBonusTotal;
    if (isPro && stackBalanceRef.current === nonProInitial) {
      const newBalance = proInitial;
      setStackBalance(newBalance);
      stackBalanceRef.current = newBalance;
    }
  }, [isPro, quoteStackBonusTotal]);

  useEffect(() => {
    if (!isPro || quotePendingProBonus <= 0) {
      return;
    }
    const released = releasePendingProQuoteBonus();
    if (released > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
        // Ignore.
      });
    }
  }, [isPro, quotePendingProBonus, releasePendingProQuoteBonus]);
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
    roundStartedAtRef.current = null;
    roundModeRef.current = gameModeRef.current;
    roundStartNetWorthRef.current = 0;
    roundStatsRef.current = {
      tradesMade: 0,
      tradesWon: 0,
      tradesLost: 0,
      biggestWinPercent: 0,
      biggestLossPercent: 0,
      longestTrade: 0,
      closestToLiquidation: 100,
    };
    setRoundSecondsRemaining(null);
    setRoundTradesMade(0);
    setIsRoundResultsVisible(false);
    setIsRoundEnded(false);
    setIsOvertime(false);
    setIsRoundActive(false);
  };

  const finalizeActiveRound = () => {
    if (!roundEndsAtRef.current) {
      return;
    }
    clearRoundTimers();
    setRoundSecondsRemaining(null);

    if (isMarginCallVisibleRef.current || isRoundResultsVisibleRef.current) {
      roundEndsAtRef.current = null;
      roundStartedAtRef.current = null;
      setIsRoundActive(false);
      return;
    }

    // Immediately disable trading
    setIsRoundEnded(true);
    setIsOvertime(false);
    setIsRoundActive(false);

    const price = getCurrentPrice() ?? BASE_PRICE;
    const startNetWorth = roundStartNetWorthRef.current || normalizeBalance(computeNetWorth(price));
    const endNetWorth = normalizeBalance(computeNetWorth(price));
    const profit = endNetWorth - startNetWorth;
    const percent = startNetWorth > 0 ? (profit / startNetWorth) * 100 : 0;
    const roundStartedAt = roundStartedAtRef.current ?? Date.now();
    const elapsedMs = Math.max(0, Date.now() - roundStartedAt);
    const durationMs = roundModeRef.current === "sprint60" ? Math.max(ROUND_DURATION_MS, elapsedMs) : elapsedMs;

    // Close positions BEFORE clearing round refs so stats are tracked.
    if (positionsRef.current.length) {
      closeAllPositionsAtPrice(price, { showToast: false, evaluateRoundCompletion: false });
    }

    roundEndsAtRef.current = null;
    roundStartedAtRef.current = null;

    setRoundResult({ startNetWorth, endNetWorth, profit, percent, durationMs, stats: { ...roundStatsRef.current } });
    setTickMs(ROUND_END_SLOW_TICK_MS);

    // Save score to local leaderboard
    addScore(endNetWorth);

    // Record lifetime stats (only for real rounds, not training wheels)
    if (!showPatternLinesRef.current) {
      recordRoundEnd({
        tradesMade: roundStatsRef.current.tradesMade,
        tradesWon: roundStatsRef.current.tradesWon,
        tradesLost: roundStatsRef.current.tradesLost,
        profitAmount: profit,
        biggestWinPercent: roundStatsRef.current.biggestWinPercent,
        biggestLossPercent: roundStatsRef.current.biggestLossPercent,
        wasLiquidated: false,
        closestToLiquidation: roundStatsRef.current.closestToLiquidation,
        durationMs,
      });
      // Leaderboards read the lifetime stats this round just updated: only the 60s sprint goes
      // to the sprint board, and all-time net profit is reported as its new (possibly lower) value.
      reportProgress({
        type: "roundEnded",
        mode: roundModeRef.current === "fiveTrades" ? "fiveTrades" : "sprint60",
        endNetWorth,
        percent,
        tradesMade: roundStatsRef.current.tradesMade,
        tradesWon: roundStatsRef.current.tradesWon,
        ...lifetimeNetProgress(),
      });
    }

    roundRevealTimeoutRef.current = setTimeout(() => {
      if (!isMarginCallVisibleRef.current) {
        setIsRoundResultsVisible(true);
      }
      roundRevealTimeoutRef.current = null;
    }, ROUND_END_SHEET_DELAY_MS);
  };

  const closeAllPositionsAtPrice = (price: number, options: { showToast: boolean; evaluateRoundCompletion?: boolean }) => {
    if (positionsRef.current.length === 0) {
      return;
    }
    const costBasis = positionsRef.current.reduce((sum, position) => sum + position.amount, 0);
    const earliestEntry = Math.min(...positionsRef.current.map((p) => p.entryTime));
    const tradeDuration = Date.now() - earliestEntry;
    const proceeds = computeOpenProceeds(price);
    const profit = proceeds - costBasis;
    // In training wheels mode, don't update the actual balance
    const nextBalance = showPatternLinesRef.current ? stackBalanceRef.current : normalizeBalance(stackBalanceRef.current + proceeds);
    stackBalanceRef.current = nextBalance;
    positionsRef.current = [];
    setPositionCount(0);
    setStackBalance(nextBalance);
    sendPatternLines();
    webViewRef.current?.injectJavaScript(`window.__addTrade && window.__addTrade("sell"); true;`);

    if (costBasis > 0) {
      if (showPatternLinesRef.current) {
        recordTrainingTrade(profit);
      } else {
        reportProgress({ type: "tradeClosed", training: false, profit });
      }
    }

    // Track trade stats during active rounds.
    if (roundEndsAtRef.current && costBasis > 0) {
      const profitPercent = (profit / costBasis) * 100;
      const tradesMade = roundStatsRef.current.tradesMade + 1;
      roundStatsRef.current.tradesMade = tradesMade;
      setRoundTradesMade(tradesMade);
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

      const shouldFinalizeByTradeCount =
        options.evaluateRoundCompletion !== false &&
        roundModeRef.current === "fiveTrades" &&
        tradesMade >= FIVE_TRADES_TARGET &&
        positionsRef.current.length === 0;
      if (shouldFinalizeByTradeCount) {
        finalizeActiveRound();
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
    if (roundModeRef.current !== "sprint60") {
      return;
    }
    if (isOvertimeRef.current) {
      return;
    }
    // If the timer ends with an open leveraged position, let it run until the position is closed.
    const hasLeveragedPosition = positionsRef.current.some((position) => (position.leverage ?? 1) > 1);
    if (hasLeveragedPosition) {
      clearRoundTimers();
      setRoundSecondsRemaining(0);
      setIsRoundEnded(true);
      setIsOvertime(true);
      setShowSpeedHint(false);
      setShowStartHint(false);
      setOvertimeBurstTrigger(Date.now());
      return;
    }
    finalizeActiveRound();
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
    setIsRoundActive(true);
    setRoundTradesMade(0);
    roundModeRef.current = "sprint60";
    roundStartedAtRef.current = Date.now();
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

  const startFiveTradesRoundIfNeeded = (price: number) => {
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
    setIsRoundActive(true);
    setRoundTradesMade(0);
    roundModeRef.current = "fiveTrades";
    roundStartedAtRef.current = Date.now();
    roundStartNetWorthRef.current = normalizeBalance(computeNetWorth(price));
    roundEndsAtRef.current = Number.POSITIVE_INFINITY;
    setRoundSecondsRemaining(null);
  };

  const startRoundIfNeeded = (price: number) => {
    if (gameModeRef.current === "fiveTrades") {
      startFiveTradesRoundIfNeeded(price);
      return;
    }
    startSprintRoundIfNeeded(price);
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

  useEffect(() => {
    // Prompt for a store review on the 2nd completed round, when the end sheet is visible.
    if (!isRoundResultsVisible) return;
    if (didTryReviewPromptRef.current) return;
    if (reviewPromptShown) return;
    if (lifetimeRounds !== 2) return;

    didTryReviewPromptRef.current = true;
    // Wait 2 seconds before showing the review prompt so users can see their results first
    const reviewTimeout = setTimeout(() => {
      void (async () => {
        try {
          if (await StoreReview.hasAction()) {
            StoreReview.requestReview();
            setReviewPromptShown(true);
          }
        } catch {
          // Ignore.
        }
      })();
    }, 1500);
    return () => clearTimeout(reviewTimeout);
  }, [isRoundResultsVisible, lifetimeRounds, reviewPromptShown, setReviewPromptShown]);

  const [gameCenterPlayer, setGameCenterPlayer] = useState<GameCenter.GameCenterPlayer | null>(null);

  // Authenticate with Game Center on app launch
  useEffect(() => {
    console.log("Attempting Game Center authentication...");
    GameCenter.authenticate()
      .then((player) => {
        console.log("Game Center auth result:", JSON.stringify(player, null, 2));
        if (player.isAuthenticated) {
          console.log("Game Center authenticated successfully:", player.displayName);
          setGameCenterPlayer(player);
          // Hide the toast after 4 seconds
          setTimeout(() => setGameCenterPlayer(null), 4000);
        } else {
          console.log("Game Center authentication failed or user cancelled.");
        }
      })
      .catch((error) => {
        console.error("Game Center authentication error in App.tsx:", error);
      });
  }, []);

  const chartTheme = useMemo(
    () => ({
      background: terminal.bg,
      textColor: darkMode ? terminal.amber : terminal.textDim,
      gridColor: darkMode ? "#1a1a1a" : "#e6e4dc",
      borderColor: terminal.borderStrong,
      overlayColor: terminal.textDim,
      fontFamily: TERMINAL_FONT,
    }),
    [darkMode, terminal],
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
    if (
      launchScreen === "game" &&
      !isRoundActive &&
      !isRoundEnded &&
      !isMarginCallVisible &&
      !isRoundResultsVisible &&
      !isPatternSettingsVisible &&
      !isTopScoreVisible &&
      !isProFeaturesVisible &&
      !showSpeedHint
    ) {
      const t = setTimeout(() => setShowStartHint(true), 2000);
      return () => clearTimeout(t);
    } else {
      setShowStartHint(false);
    }
  }, [
    launchScreen,
    isRoundActive,
    isRoundEnded,
    isMarginCallVisible,
    isRoundResultsVisible,
    isPatternSettingsVisible,
    isTopScoreVisible,
    isProFeaturesVisible,
    showSpeedHint,
  ]);

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
      const released = releasePendingProQuoteBonus();
      if (released > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
          // Ignore.
        });
      }
      setIsProFeaturesVisible(false);
      // Optional: Show celebration or thank you
    }
  };

  const settingsSections: SettingsSection[] = useMemo(() => {
    const accountRows: SettingsRow[] = [
      {
        id: "topScores",
        label: "My Top Scores",
        subtitle: "View your best local runs.",
        icon: TwemojiTrophy,
        onPress: () => setIsTopScoreVisible(true),
      },
      {
        id: "totalStats",
        label: "Total Stats",
        subtitle: "Open your all-time performance breakdown.",
        icon: TwemojiBarChart,
        onPress: () => setIsTotalStatsVisible(true),
      },
      {
        id: "globalLeaderboard",
        label: "Leaderboard: 60s Sprint",
        subtitle: "Best end-of-round stack worldwide.",
        icon: TwemojiChartUp,
        onPress: () => openLeaderboard(GameCenter.LEADERBOARDS.HIGH_SCORE),
      },
      {
        id: "fiveTradesLeaderboard",
        label: "Leaderboard: 5 Trades",
        subtitle: "Best end-of-run stack worldwide.",
        icon: TwemojiTarget,
        onPress: () => openLeaderboard(GameCenter.LEADERBOARDS.FIVE_TRADES),
      },
      {
        id: "globalProfitLeaderboard",
        label: "Leaderboard: All-Time Profit",
        subtitle: "Net profit across every round you've played.",
        icon: TwemojiMoneyBag,
        onPress: () => openLeaderboard(GameCenter.LEADERBOARDS.NET_PROFIT),
      },
      {
        id: "achievements",
        label: "Achievements",
        subtitle: "See what you've unlocked.",
        icon: TwemojiMedal,
        onPress: () => void GameCenter.showAchievements(),
      },
    ];

    const appRows: SettingsRow[] = [
      {
        id: "rate",
        label: "Rate This App",
        subtitle: "Leave a review in the App Store / Play Store.",
        icon: TwemojiStar,
        onPress: () => {
          void (async () => {
            if (await StoreReview.hasAction()) {
              StoreReview.requestReview();
            } else {
              Alert.alert("Error", "Store review is not available on this device.");
            }
          })();
        },
      },
      {
        id: "darkMode",
        label: darkMode ? "Light Terminal" : "Dark Terminal",
        subtitle: isPro ? "Switch between the light and dark terminal." : "Dark terminal is a Pro feature.",
        icon: TwemojiMoon,
        onPress: () => {
          if (!isPro) {
            setIsProFeaturesVisible(true);
            return;
          }
          setDarkMode(!darkMode);
        },
      },
      {
        id: "buyPro",
        label: isPro ? "Pro Active" : proPrice ? `Buy Pro (${proPrice})` : "Buy Pro",
        subtitle: isPro ? "Thanks for supporting the game." : "Unlock all premium features.",
        icon: TwemojiLock,
        onPress: () => {
          if (isPro) {
            return;
          }
          setIsProFeaturesVisible(true);
        },
      },
      {
        id: "restore",
        label: "Restore Purchases",
        subtitle: "Recover previous Pro purchases on this device.",
        icon: TwemojiRestore,
        onPress: () => {
          void restorePurchases();
        },
      },
    ];

    const sections: SettingsSection[] = [
      { id: "account", title: "Account", rows: accountRows },
      { id: "app", title: "App", rows: appRows },
    ];

    if (__DEV__) {
      sections.push({
        id: "developer",
        title: "Developer",
        rows: [
          {
            id: "debugPro",
            label: debugProOverride ? "Disable Debug Pro" : "Enable Debug Pro",
            subtitle: "Local-only test override for Pro state.",
            icon: TwemojiWrench,
            onPress: () => setDebugProOverride((prev) => !prev),
          },
        ],
      });
    }

    return sections;
  }, [darkMode, debugProOverride, isPro, proPrice, restorePurchases, setDarkMode]);

  const openSettings = () => {
    navigateTo("settings", "forward");
  };

  const pickMarginCallVariant = (): MarginCallVariant => {
    const roll = Math.random();
    if (roll < 0.2) return "incomingCall";
    if (roll < 0.4) return "breakingNews";
    if (roll < 0.6) return "instruction";
    if (roll < 0.8) return "mirror";
    return "classic";
  };

  const applyChartType = (nextType: ChartType) => {
    setChartType(nextType);
    webViewRef.current?.injectJavaScript(`window.__setChartType && window.__setChartType(${JSON.stringify(nextType)}); true;`);
  };

  const resetChartView = () => {
    // Follow should never reset/fit scales; only re-enable follow mode.
    webViewRef.current?.injectJavaScript(`window.__enableFollow && window.__enableFollow(); true;`);
    setIsChartFollowing(true);
  };

  const applyZoomOutPreset = (preset: 1 | 2 | 3) => {
    setZoomPreset(preset);
    webViewRef.current?.injectJavaScript(
      `window.__setZoomOutPreset && window.__setZoomOutPreset(${preset}); window.__enableFollow && window.__enableFollow(); true;`,
    );
    setIsChartFollowing(true);
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
    resetTrainingSession();

    stackBalanceRef.current = initialStackBalance;
    setStackBalance(initialStackBalance);
    positionsRef.current = [];
    setPositionCount(0);

    patternQueueRef.current = [];
    targetQueueRef.current = [];
    hasSpawnedPattern.current = false;
    patternLinesRef.current = [];
    quizPendingRef.current = null;
    quizPausedRef.current = false;
    quizRevealLinesRef.current = false;
    setQuizPrompt(null);

    candleIndexRef.current = 0;
    baseTimeRef.current = null;
    candlesRef.current = [];
    latestChartDataRef.current = [];
    hasSentFullDataRef.current = false;
    lineUpdateCounterRef.current = 0;

    setTickMs(baseTickMsRef.current);

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
    setTickMs(baseTickMsRef.current);
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
    if (isRoundEnded) {
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
    startRoundIfNeeded(price);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const positionSize = amount * leverage;
    const units = positionSize / price;
    positionsRef.current = [...positionsRef.current, { entryPrice: price, units, amount, side, leverage, entryTime: Date.now() }];
    setPositionCount(positionsRef.current.length); // Always update for re-render
    // In training wheels mode, don't update the actual balance or stats
    if (!showPatternLinesRef.current) {
      const nextBalance = normalizeBalance(balance - amount);
      stackBalanceRef.current = nextBalance;
      // Don't update displayed stackBalance here - keep showing full stack in top bar
      // The balance will be updated when the trade is closed
      // Track leverage usage (only for leveraged trades, not spot)
      if (leverage > 1) {
        recordLeverageUse(leverage);
      }
      reportProgress({ type: "tradeOpened", training: false, leverage });
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
    const inOvertime = isOvertimeRef.current;
    closeAllPositionsAtPrice(price, { showToast: true });
    if (inOvertime && positionsRef.current.length === 0) {
      finalizeActiveRound();
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

  // Lines are drawn the way a trader would draw them: each appears once its second touch has
  // printed, runs from its first touch to the latest candle, and stops a few candles past the
  // breakout.
  const buildPatternLines = () => {
    const candles = candlesRef.current;
    // Pattern lines show with training wheels on, or once a Pop Quiz answer is revealed.
    if (!candles.length || (!showPatternLinesRef.current && !quizRevealLinesRef.current)) {
      return [];
    }
    const lastIndex = candles[candles.length - 1]?.index ?? candles.length - 1;
    const baseTime = baseTimeRef.current ?? Math.floor(Date.now() / 1000) - lastIndex * 60;
    const toTime = (index: number) => Math.floor(baseTime + index * 60);
    const lines: { id: string; kind: PatternLineKind; points: { time: number; value: number }[] }[] = [];
    for (const line of patternLinesRef.current) {
      if (lastIndex < line.revealIndex) {
        continue;
      }
      const until = Math.min(lastIndex, line.endIndex);
      const points: { time: number; value: number }[] = [];
      let previous: { index: number; price: number } | null = null;
      for (const point of line.points) {
        if (point.index > until) {
          // Interpolate the point where the line currently ends.
          if (previous && until > previous.index) {
            const t = (until - previous.index) / (point.index - previous.index);
            points.push({ time: toTime(until), value: previous.price + (point.price - previous.price) * t });
          }
          previous = null;
          break;
        }
        points.push({ time: toTime(point.index), value: point.price });
        previous = point;
      }
      const tail = line.points.length >= 2 ? line.points.slice(-2) : null;
      if (previous && tail && until > previous.index) {
        // Past the last anchor: project the final segment straight on.
        const [a, b] = tail;
        const slope = (b.price - a.price) / Math.max(1, b.index - a.index);
        points.push({ time: toTime(until), value: b.price + slope * (until - b.index) });
      }
      if (points.length >= 2) {
        lines.push({ id: line.id, kind: line.kind, points });
      }
    }
    return lines;
  };

  /** True while some pattern line is still growing with each new candle. */
  const hasGrowingPatternLine = () => {
    if (!showPatternLinesRef.current && !quizRevealLinesRef.current) {
      return false;
    }
    const candles = candlesRef.current;
    const lastIndex = candles[candles.length - 1]?.index ?? 0;
    return patternLinesRef.current.some((line) => lastIndex >= line.revealIndex && lastIndex <= line.endIndex + 1);
  };

  const buildPatternLinesScript = () => {
    const liquidation = getLiquidationPrice();
    return (
      `window.__setPatternLines && window.__setPatternLines(${JSON.stringify(buildPatternLines())});` +
      `window.__setLiquidationLine && window.__setLiquidationLine(${liquidation ? liquidation.price : "null"});`
    );
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
    webViewRef.current?.injectJavaScript(`${buildPatternLinesScript()} true;`);
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
        } else if (debugMessage.startsWith("follow:on")) {
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
    // `preventAutoHideAsync()` is called in `app/_layout.tsx`. Hide the native splash after
    // a short delay so users have time to read the text, before the AnimatedSplash overlay takes over.
    const splashTimeout = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {
        // Ignore.
      });
    }, 1000);
    return () => clearTimeout(splashTimeout);
  }, []);

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
      if (speedHintTimeoutRef.current) {
        clearTimeout(speedHintTimeoutRef.current);
        speedHintTimeoutRef.current = null;
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

  // Pop Quiz only asks about patterns with a direction; Range has no right answer.
  const getQuizPatternIds = () => {
    const directional = allPatterns.filter((pattern) => pattern.bias !== "neutral").map((pattern) => pattern.id);
    const enabled = directional.filter((id) => enabledPatternIdsRef.current.includes(id));
    return enabled.length > 0 ? enabled : directional;
  };

  useEffect(() => {
    if (launchScreen !== "game") {
      return;
    }
    const timer = setInterval(() => {
      if (quizPausedRef.current) {
        return;
      }
      const candles = candlesRef.current;
      const lastClose = candles.length ? candles[candles.length - 1].close : BASE_PRICE;
      let shouldUpdateLines = false;
      if (patternQueueRef.current.length === 0 && targetQueueRef.current.length === 0) {
        if (!hasSpawnedPattern.current || Math.random() < PATTERN_SPAWN_CHANCE) {
          const isTraining = showPatternLinesRef.current;
          const isQuiz = gameModeRef.current === "quiz";
          const enabledIds = isQuiz ? getQuizPatternIds() : isTraining ? enabledPatternIdsRef.current : undefined;
          const pattern = choosePattern(lastClose, enabledIds);
          setCurrentPatternLabel(pattern?.label ?? null);
          if (isQuiz) {
            quizRevealLinesRef.current = false;
            quizIdRef.current += 1;
            quizPendingRef.current =
              pattern?.bias && pattern.bias !== "neutral"
                ? { id: quizIdRef.current, patternLabel: pattern.label, direction: pattern.bias }
                : null;
          }
          if (pattern) {
            const result = pattern.generate(lastClose);
            patternQueueRef.current = result.candles;
            targetQueueRef.current = result.runout;
            const patternStartIndex = candleIndexRef.current;
            patternLinesRef.current = result.lines.map((line) => ({
              id: line.id,
              kind: line.type,
              points: line.points.map((point) => ({ index: patternStartIndex + point.offset, price: point.price })),
              revealIndex: patternStartIndex + line.revealOffset,
              endIndex: patternStartIndex + line.points[line.points.length - 1].offset + line.extendBy,
            }));
            hasSpawnedPattern.current = true;
            shouldUpdateLines = true;
          }
        }
      }

      let nextBase: Candle;
      if (patternQueueRef.current.length > 0) {
        nextBase = patternQueueRef.current.shift()!;
        if (patternQueueRef.current.length === 0 && quizPendingRef.current) {
          // Last candle of the pattern: halt before the breakout and ask.
          const pending = quizPendingRef.current;
          quizPendingRef.current = null;
          quizPausedRef.current = true;
          setQuizPrompt({ ...pending, answer: null });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
      } else if (targetQueueRef.current.length > 0) {
        nextBase = targetQueueRef.current.shift()!;
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

      let barScript = "";
      if (isWebReadyRef.current) {
        if (!hasSentFullDataRef.current) {
          sendFullChartData();
        } else {
          barScript = `window.__updateChartData && window.__updateChartData(${JSON.stringify(bar)});`;
        }
      }

      if (positionsRef.current.length && roundEndsAtRef.current) {
        const liquidation = getLiquidationPrice();
        if (liquidation) {
          // Calculate distance to liquidation as percentage
          const distanceToLiq =
            liquidation.side === "long"
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
            // A position stack is opened and closed as one aggregate trade.
            roundStatsRef.current.tradesMade += 1;
            roundStatsRef.current.tradesLost += 1;

            // Capture stats BEFORE resetRoundState resets them
            const capturedStats = { ...roundStatsRef.current };
            const capturedRoundStartedAt = roundStartedAtRef.current;
            const margin = positionsRef.current.reduce((sum, position) => sum + position.amount, 0);
            // The whole round's P&L, not just the lost margin: trades closed earlier in the round
            // count too. Margin was already taken out of the stack when the position opened.
            const roundStart = roundStartNetWorthRef.current || normalizeBalance(stackBalanceRef.current + margin);
            const roundProfit = normalizeBalance(stackBalanceRef.current) - roundStart;
            if (showPatternLinesRef.current) {
              recordTrainingTrade(-margin);
            } else {
              // Recorded right away (not when the margin-call sheet appears) so leaving for the
              // menu in the meantime can't drop the loss from the all-time total.
              recordRoundEnd({
                tradesMade: capturedStats.tradesMade,
                tradesWon: capturedStats.tradesWon,
                tradesLost: capturedStats.tradesLost,
                profitAmount: roundProfit,
                biggestWinPercent: capturedStats.biggestWinPercent,
                biggestLossPercent: capturedStats.biggestLossPercent,
                wasLiquidated: true,
                closestToLiquidation: 0,
                durationMs: capturedRoundStartedAt ? Math.max(0, Date.now() - capturedRoundStartedAt) : ROUND_DURATION_MS,
                liquidationLeverage: liquidatedLeverage,
              });
              reportProgress({ type: "liquidated", ...lifetimeNetProgress() });
            }

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
            }, 900);
            shouldUpdateLines = true;
          }
        }
      }

      lineUpdateCounterRef.current += 1;
      const linesDue = shouldUpdateLines || hasGrowingPatternLine() || (positionsRef.current.length > 0 && lineUpdateCounterRef.current % 5 === 0);
      // One bridge call per tick: the new bar and, when needed, the lines that grew with it.
      const tickScript = barScript + (linesDue && isWebReadyRef.current ? buildPatternLinesScript() : "");
      if (tickScript) {
        webViewRef.current?.injectJavaScript(`${tickScript} true;`);
      }
    }, tickMs);

    return () => clearInterval(timer);
  }, [launchScreen, tickMs]);

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

  const toastTitle = tradeToast
    ? showPatternLines
      ? `${lastTradeLabelRef.current}  SESSION ${trainingReturn > 0 ? "+" : ""}${trainingReturn.toFixed(2)}%`
      : `${lastTradeLabelRef.current}  ${formatSignedMoney(tradeToast.amount)}`
    : "";
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
  const showOvertimeHint = isOvertime && positionCount > 0 && !isRoundResultsVisible && !isMarginCallVisible;
  const shouldShowInGameBanner = (showStartHint || showSpeedHint || showOvertimeHint) && !isInGameBannerDismissed;
  const isTrainingMode = gameMode === "training";
  const isFiveTradesMode = gameMode === "fiveTrades";
  const isQuizMode = gameMode === "quiz";
  const modeLabel = isFiveTradesMode ? "5 Trades" : isTrainingMode ? "Training Wheels" : isQuizMode ? "Pop Quiz" : "60s Sprint";

  const launchGameMode = (mode: GameMode) => {
    if (isScreenTransitioningRef.current) {
      return;
    }
    setShowStartHint(false);
    setShowSpeedHint(false);
    const enableTraining = mode === "training";
    setShowPatternLines(enableTraining);
    showPatternLinesRef.current = enableTraining;
    setGameMode(mode);
    gameModeRef.current = mode;
    roundModeRef.current = mode;
    if (mode === "quiz") {
      setQuizScore(EMPTY_QUIZ_SCORE);
    }
    resetRun();
    navigateTo("game", "forward");
  };

  const answerQuiz = (side: QuizSide) => {
    if (!quizPrompt || quizPrompt.answer) {
      return;
    }
    const correct = isQuizAnswerCorrect(quizPrompt, side);
    setQuizPrompt({ ...quizPrompt, answer: side });
    reportProgress({ type: "quizAnswered", correct, streak: correct ? quizScore.streak + 1 : 0 });
    setQuizScore((prev) => {
      const streak = correct ? prev.streak + 1 : 0;
      return {
        correct: prev.correct + (correct ? 1 : 0),
        total: prev.total + 1,
        streak,
        bestStreak: Math.max(prev.bestStreak, streak),
      };
    });
    Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    // Show the trendlines so the player can see what they just missed (or nailed).
    quizRevealLinesRef.current = true;
    sendPatternLines();
  };

  const resumeQuizMarket = () => {
    setQuizPrompt(null);
    quizPausedRef.current = false;
  };

  const openLeaderboard = (leaderboardId: string) => {
    if (!leaderboardId) {
      Alert.alert("Coming soon", "This leaderboard isn't live on this platform yet.");
      return;
    }
    void GameCenter.showLeaderboard(leaderboardId);
  };

  /**
   * Leaving for the menu mid-round used to throw the round away, so a losing run could be quit
   * and its loss never reached the all-time total. Settle it instead: close open positions at
   * the current price and record the round's P&L (no results sheet, no sprint/5 Trades score).
   */
  const settleAbandonedRound = () => {
    if (!roundEndsAtRef.current || showPatternLinesRef.current) {
      return;
    }
    const price = getCurrentPrice() ?? BASE_PRICE;
    const startNetWorth = roundStartNetWorthRef.current || normalizeBalance(computeNetWorth(price));
    if (positionsRef.current.length) {
      closeAllPositionsAtPrice(price, { showToast: false, evaluateRoundCompletion: false });
    }
    const profit = normalizeBalance(stackBalanceRef.current) - startNetWorth;
    const stats = roundStatsRef.current;
    const roundStartedAt = roundStartedAtRef.current;
    roundEndsAtRef.current = null;
    roundStartedAtRef.current = null;
    if (stats.tradesMade === 0 && Math.abs(profit) < 0.005) {
      return;
    }
    recordRoundEnd({
      tradesMade: stats.tradesMade,
      tradesWon: stats.tradesWon,
      tradesLost: stats.tradesLost,
      profitAmount: profit,
      biggestWinPercent: stats.biggestWinPercent,
      biggestLossPercent: stats.biggestLossPercent,
      wasLiquidated: false,
      closestToLiquidation: stats.closestToLiquidation,
      durationMs: roundStartedAt ? Math.max(0, Date.now() - roundStartedAt) : 0,
    });
    reportProgress({ type: "roundAbandoned", ...lifetimeNetProgress() });
  };

  const openMenuScreen = () => {
    if (isScreenTransitioningRef.current) {
      return;
    }
    settleAbandonedRound();
    setShowStartHint(false);
    setShowSpeedHint(false);
    setIsPatternSettingsVisible(false);
    setIsProFeaturesVisible(false);
    setIsTopScoreVisible(false);
    setIsTotalStatsVisible(false);
    setIsRoundResultsVisible(false);
    setIsMarginCallVisible(false);
    resetRun();
    navigateTo("menu", "back");
  };

  useEffect(() => {
    if (launchScreen === "menu") {
      return undefined;
    }

    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      openMenuScreen();
      return true;
    });
    return () => subscription.remove();
  }, [launchScreen]);

  const handleClaimDailyQuoteBonus = () => {
    if (!canClaimDailyQuote) {
      return;
    }
    const baseBonus = isPro ? 10 : 5;
    const pendingProExtra = isPro ? 0 : 5;
    const didClaim = claimDailyQuoteBonus(todayDayKey, baseBonus, pendingProExtra);
    if (!didClaim) {
      return;
    }
    const nextBalance = normalizeBalance(stackBalanceRef.current + baseBonus);
    stackBalanceRef.current = nextBalance;
    setStackBalance(nextBalance);
    quoteCashDropProgress.value = 0;
    quoteCashDropProgress.value = withTiming(1, {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });

    // Small paper bump on Lock In.
    quotePaperShake.value = withSequence(
      withTiming(1, { duration: 50 }),
      withTiming(-1, { duration: 60 }),
      withTiming(0, { duration: 50 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
      // Ignore.
    });

    // Count the stack value up from old to new with a green flash.
    const fromStack = initialStackBalance;
    const toStack = initialStackBalance + baseBonus;
    const COUNT_MS = 600;
    const countStart = Date.now();
    if (quoteStackCountFrameRef.current != null) {
      cancelAnimationFrame(quoteStackCountFrameRef.current);
    }
    setQuoteStackDisplay(fromStack);
    const tickCount = () => {
      const t = Math.min(1, (Date.now() - countStart) / COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      if (t < 1) {
        setQuoteStackDisplay(fromStack + (toStack - fromStack) * eased);
        quoteStackCountFrameRef.current = requestAnimationFrame(tickCount);
      } else {
        quoteStackCountFrameRef.current = null;
        setQuoteStackDisplay(null);
      }
    };
    quoteStackCountFrameRef.current = requestAnimationFrame(tickCount);
    quoteStackFlash.value = withSequence(
      withTiming(1, { duration: 90 }),
      withDelay(COUNT_MS, withTiming(0, { duration: 320 })),
    );

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {
      // Ignore.
    });
  };

  const dismissInGameBanner = () => {
    setIsInGameBannerDismissed(true);
    setShowStartHint(false);
    setShowSpeedHint(false);
  };

  const launchMenuItems: {
    id: string;
    title: string;
    subtitle: string;
    accent: string;
    accessibilityLabel?: string;
    onPress: () => void;
  }[] = [
    {
      id: "dailyQuote",
      title: "Daily Quote",
      subtitle: "A money quote for today",
      accent: terminal.amber,
      onPress: () => navigateTo("dailyQuote", "forward"),
    },
    {
      id: "sprint60",
      title: "60 Second Game",
      subtitle: "Current sprint mode",
      accent: terminal.green,
      onPress: () => launchGameMode("sprint60"),
    },
    {
      id: "fiveTrades",
      title: "5 Trades, Your Pace",
      subtitle: "5 closes and the run ends",
      accent: terminal.blue,
      onPress: () => launchGameMode("fiveTrades"),
    },
    {
      id: "training",
      title: "Training Wheels",
      subtitle: "Pattern guide mode",
      accent: terminal.yellow,
      onPress: () => launchGameMode("training"),
    },
    {
      id: "quiz",
      title: "Pop Quiz",
      subtitle: "Chart freezes, you call long or short",
      accent: terminal.blue,
      onPress: () => launchGameMode("quiz"),
    },
    {
      id: "pro",
      title: isPro ? "Pro Active" : "Buy Pro",
      subtitle: isPro ? "Thanks for supporting" : proPrice ? `Unlock all features (${proPrice})` : "Unlock all features",
      accent: terminal.red,
      onPress: () => {
        if (isPro) {
          return;
        }
        setIsProFeaturesVisible(true);
      },
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "Stats, leaderboards, and app options",
      accent: terminal.textDim,
      onPress: openSettings,
    },
  ];

  if (launchScreen === "menu") {
    return (
      <>
        <Animated.View key="menu" entering={screenEntering} exiting={screenExiting} style={styles.screenTransition}>
          <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.container, { backgroundColor: terminal.bg }]}>
          <Stack.Screen options={{ statusBarStyle: darkMode ? "light" : "dark", statusBarAnimation: "fade" }} />
          <View style={[styles.terminalHeader, { backgroundColor: terminal.header }]}>
            <Text style={[styles.terminalHeaderBrand, { color: terminal.headerText }]}>STONKS</Text>
            <Text style={[styles.terminalHeaderMeta, { color: terminal.headerText }]}>{isPro ? "PRO" : "MAIN"} MENU &lt;GO&gt;</Text>
          </View>
          <ScrollView style={styles.launchMenu} contentContainerStyle={styles.launchMenuContent} bounces={false} showsVerticalScrollIndicator={false}>
            {launchMenuItems.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityLabel={item.accessibilityLabel}
                onPress={item.onPress}
                style={({ pressed }) => [
                  styles.launchMenuButton,
                  { minHeight: launchMenuButtonMinHeight, borderBottomColor: terminal.border },
                  pressed && { backgroundColor: terminal.panelAlt },
                ]}
              >
                <View style={[styles.launchMenuCode, { backgroundColor: item.accent }]}>
                  <Text style={[styles.launchMenuCodeText, { color: getReadableTextOn(item.accent) }]}>{index + 1}</Text>
                </View>
                <View style={styles.launchMenuTextWrap}>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[styles.launchMenuTitle, isNarrowScreen && styles.launchMenuTitleCompact, { color: terminal.text }]}
                  >
                    {item.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.launchMenuSubtitle, { color: terminal.textDim }]}>
                    {item.subtitle}
                  </Text>
                </View>
                <Text style={[styles.launchMenuGo, { color: item.accent }]}>&lt;GO&gt;</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ProFeaturesModal
            visible={isProFeaturesVisible}
            darkMode={darkMode}
            price={proPrice}
            onBuy={handleBuyPro}
            onClose={() => setIsProFeaturesVisible(false)}
            isPurchasing={isRevenueCatLoading}
          />
          </SafeAreaView>
        </Animated.View>
        {showAnimatedSplash && <AnimatedSplash darkMode={darkMode} onComplete={() => setShowAnimatedSplash(false)} />}
      </>
    );
  }

  if (launchScreen === "dailyQuote") {
    const quoteStackValue = quoteStackDisplay ?? initialStackBalance;
    // The paper now gets the spare height, so let the headline grow on taller screens.
    const dailyQuotePaperFontSize = Math.round(dailyQuoteFontSize * (isCompactHeight ? 1 : windowHeight >= 850 ? 1.28 : 1.12));
    return (
      <>
        <Animated.View key="dailyQuote" entering={screenEntering} exiting={screenExiting} style={styles.screenTransition}>
          <SafeAreaView edges={["top", "left", "right", "bottom"]} style={[styles.container, { backgroundColor: terminal.bg }]}>
          <Stack.Screen options={{ statusBarStyle: darkMode ? "light" : "dark", statusBarAnimation: "fade" }} />
          <View style={[styles.terminalHeader, { backgroundColor: terminal.header }]}>
            <View style={styles.dailyQuoteHeaderLeft}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  openMenuScreen();
                }}
                style={({ pressed }) => [styles.dailyQuoteHeaderBack, { borderColor: terminal.headerText }, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.dailyQuoteHeaderBackText, { color: terminal.headerText }]}>&lt; BACK</Text>
              </Pressable>
              <Text numberOfLines={1} style={[styles.terminalHeaderBrand, styles.dailyQuoteHeaderBrand, { color: terminal.headerText }]}>
                DAILY MONEY
              </Text>
            </View>
            <View style={styles.dailyQuoteHeaderMetaRow}>
              <Text style={[styles.terminalHeaderMeta, { color: terminal.headerText }]}>DQ &lt;GO&gt;</Text>
              <Animated.Text style={[styles.terminalHeaderMeta, { color: terminal.headerText }, quoteCursorStyle]}>{"\u2588"}</Animated.Text>
            </View>
          </View>
          <View style={[styles.dailyQuoteScreen, { backgroundColor: terminal.bg }]}>
            <ScrollView
              style={styles.dailyQuoteScroll}
              contentContainerStyle={[styles.dailyQuoteContent, { paddingTop: isCompactHeight ? 8 : 14 }]}
              showsVerticalScrollIndicator={false}
            >
            <View
              style={styles.dailyQuotePaperStage}
              onLayout={(event) => {
                quotePaperWidth.value = event.nativeEvent.layout.width;
              }}
            >
              <Animated.View
                style={[styles.dailyQuotePaper, isCompactHeight && styles.dailyQuotePaperCompact, darkMode && styles.dailyQuotePaperDark, quotePaperStyle]}
              >
                <View style={[styles.dailyQuoteTopRule, darkMode && styles.dailyQuoteTopRuleDark]} />
                <View style={[styles.dailyQuoteTopRuleThin, darkMode && styles.dailyQuoteTopRuleThinDark]} />
                <Text style={[styles.dailyQuoteMasthead, darkMode && styles.dailyQuoteMastheadDark]}>Daily Money</Text>
                <View style={styles.dailyQuoteDateLine}>
                  <View style={[styles.dailyQuoteDateDivider, darkMode && styles.dailyQuoteDateDividerDark]} />
                  <Text style={[styles.dailyQuoteDate, darkMode && styles.dailyQuoteDateDark]}>{dailyMoneyDateLine}</Text>
                  <View style={[styles.dailyQuoteDateDivider, darkMode && styles.dailyQuoteDateDividerDark]} />
                </View>
                <Animated.View style={[styles.dailyQuoteHeadlineWrap, quoteHeadlineStyle]}>
                  <Text
                    style={[
                      styles.dailyQuoteHeadline,
                      { fontSize: dailyQuotePaperFontSize, lineHeight: Math.round(dailyQuotePaperFontSize * 1.2) },
                      darkMode && styles.dailyQuoteHeadlineDark,
                    ]}
                  >
                    “{dailyMoneyQuote.text}”
                  </Text>
                  <View style={[styles.dailyQuoteHeadlineRule, darkMode && styles.dailyQuoteHeadlineRuleDark]} />
                </Animated.View>
                <Animated.View style={quoteBylineStyle}>
                  <View style={styles.dailyQuoteBylineRow}>
                    <Text style={[styles.dailyQuoteByline, darkMode && styles.dailyQuoteBylineDark]}>By {dailyMoneyQuote.author}</Text>
                    {dailyMoneyQuote.unconfirmed ? (
                      <View style={[styles.dailyQuoteUnconfirmedStamp, darkMode && styles.dailyQuoteUnconfirmedStampDark]}>
                        <Text style={[styles.dailyQuoteUnconfirmedText, darkMode && styles.dailyQuoteUnconfirmedTextDark]}>Unconfirmed</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.dailyQuoteSource, darkMode && styles.dailyQuoteSourceDark]}>{dailyMoneyQuote.source}</Text>
                </Animated.View>
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[styles.dailyQuotePaperCover, { backgroundColor: terminal.bg, width: windowWidth + 40 }, quotePaperCoverStyle]}
              />
              <Animated.View pointerEvents="none" style={[styles.dailyQuotePaperRoll, quotePaperRollStyle]}>
                <View style={styles.dailyQuotePaperRollBody}>
                  <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 10 10">
                    <Defs>
                      <SvgLinearGradient id="quoteRoll" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={darkMode ? "#0f0d0a" : "#b9aa86"} />
                        <Stop offset="0.35" stopColor={darkMode ? "#3a352b" : "#fbf6ea"} />
                        <Stop offset="0.6" stopColor={darkMode ? "#2a261f" : "#ece2cb"} />
                        <Stop offset="1" stopColor={darkMode ? "#0b0a08" : "#a8996f"} />
                      </SvgLinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="10" height="10" fill="url(#quoteRoll)" />
                  </Svg>
                </View>
              </Animated.View>
            </View>
            </ScrollView>
            <View style={styles.dailyQuoteFooter}>
              <View style={styles.dailyQuoteStatsRow}>
                <View style={styles.dailyQuoteMoneyRow}>
                  <View style={styles.dailyQuoteMoneyIconWrap}>
                    <TwemojiBanknote width={26} height={26} />
                    <Animated.View pointerEvents="none" style={[styles.dailyQuoteDropCash, quoteCashDropStyle1]}>
                      <TwemojiBanknote width={20} height={20} />
                    </Animated.View>
                    <Animated.View pointerEvents="none" style={[styles.dailyQuoteDropCash, quoteCashDropStyle2]}>
                      <TwemojiBanknote width={18} height={18} />
                    </Animated.View>
                    <Animated.View pointerEvents="none" style={[styles.dailyQuoteDropCash, quoteCashDropStyle3]}>
                      <TwemojiBanknote width={16} height={16} />
                    </Animated.View>
                  </View>
                  <Text style={[styles.dailyQuoteStackLabel, { color: terminal.amber }]}>STACK</Text>
                  <Animated.Text style={[styles.dailyQuoteMoneyText, quoteStackValueStyle]}>${formatMoney(quoteStackValue)}</Animated.Text>
                </View>
                {!isPro && (
                  <View style={[styles.dailyQuoteProCounter, { borderColor: terminal.amber }]}>
                    <Text style={[styles.dailyQuoteProCounterText, { color: terminal.amber }]}>
                      MOM SAVED +${formatMoney(quotePendingProBonus)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.dailyQuoteActionsRow}>
                <UiButton
                  title={canClaimDailyQuote ? `🔒 Lock In +$${isPro ? 10 : 5}` : "🔒 Locked Today"}
                  onPress={handleClaimDailyQuoteBonus}
                  disabled={!canClaimDailyQuote}
                  variant="borderedProminent"
                  color={terminal.green}
                  style={styles.dailyQuoteLockButton}
                  darkMode={darkMode}
                />
                {!isPro && (
                  <UiButton
                    title={proPrice ? `Pro ${proPrice}` : "Go Pro"}
                    onPress={() => setIsProFeaturesVisible(true)}
                    variant="borderedProminent"
                    color={terminal.red}
                    style={styles.dailyQuoteBuyProButton}
                    darkMode={darkMode}
                  />
                )}
              </View>
              <Text numberOfLines={1} style={[styles.dailyQuoteClaimHint, { color: terminal.textDim }]}>
                {canClaimDailyQuote
                  ? isPro
                    ? "+$10 once per day."
                    : "+$5 once per day. Pro gives +$10."
                  : "Back tomorrow for the next lock-in."}
              </Text>
            </View>
          </View>
          <ProFeaturesModal
            visible={isProFeaturesVisible}
            darkMode={darkMode}
            price={proPrice}
            onBuy={handleBuyPro}
            onClose={() => setIsProFeaturesVisible(false)}
            isPurchasing={isRevenueCatLoading}
          />
          </SafeAreaView>
        </Animated.View>
        {showAnimatedSplash && <AnimatedSplash darkMode={darkMode} onComplete={() => setShowAnimatedSplash(false)} />}
      </>
    );
  }

  if (launchScreen === "settings") {
    return (
      <>
        <Animated.View key="settings" entering={screenEntering} exiting={screenExiting} style={styles.screenTransition}>
          <SafeAreaView
            edges={["top", "left", "right", "bottom"]}
            style={[styles.container, styles.settingsSafeArea, darkMode && styles.settingsSafeAreaDark]}
          >
          <Stack.Screen options={{ statusBarStyle: darkMode ? "light" : "dark", statusBarAnimation: "fade" }} />
          <View style={[styles.settingsScreen, darkMode && styles.settingsScreenDark]}>
            <View style={[styles.settingsHeaderRow, styles.settingsContentWidth]}>
              <UiButton title="← Back" onPress={openMenuScreen} variant="bordered" darkMode={darkMode} />
            </View>
            <View style={[styles.settingsHeaderBlock, styles.settingsContentWidth]}>
              <Text style={[styles.settingsTitle, darkMode && styles.settingsTitleDark]}>Settings</Text>
              <Text style={[styles.settingsSubtitle, darkMode && styles.settingsSubtitleDark]}>
                {isPro ? "Pro member settings" : "Manage gameplay, account, and app preferences"}
              </Text>
            </View>
            <ScrollView style={styles.settingsScroll} contentContainerStyle={styles.settingsScrollContent} showsVerticalScrollIndicator={false}>
              {settingsSections.map((section) => (
                <View key={section.id} style={styles.settingsSection}>
                  <Text style={[styles.settingsSectionTitle, darkMode && styles.settingsSectionTitleDark]}>{section.title}</Text>
                  <View style={[styles.settingsCard, darkMode && styles.settingsCardDark]}>
                    {section.rows.map((row, index) => (
                      <Pressable
                        key={row.id}
                        onPress={row.onPress}
                        style={({ pressed }) => [
                          styles.settingsRow,
                          darkMode && styles.settingsRowDark,
                          index < section.rows.length - 1 && styles.settingsRowBorder,
                          darkMode && index < section.rows.length - 1 && styles.settingsRowBorderDark,
                          pressed && styles.settingsRowPressed,
                          darkMode && pressed && styles.settingsRowPressedDark,
                        ]}
                      >
                        <View style={styles.settingsRowLeading}>
                          <View style={styles.settingsRowIconWrap}>
                            <row.icon width={22} height={22} />
                          </View>
                          <View style={styles.settingsRowTextWrap}>
                            <Text style={[styles.settingsRowLabel, darkMode && styles.settingsRowLabelDark]}>{row.label}</Text>
                            <Text style={[styles.settingsRowSubtitle, darkMode && styles.settingsRowSubtitleDark]}>{row.subtitle}</Text>
                          </View>
                        </View>
                        <Text style={[styles.settingsRowChevron, darkMode && styles.settingsRowChevronDark]}>›</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
          <TopScoreModal visible={isTopScoreVisible} darkMode={darkMode} onClose={() => setIsTopScoreVisible(false)} />
          <TotalStatsModal visible={isTotalStatsVisible} darkMode={darkMode} onClose={() => setIsTotalStatsVisible(false)} />
          <ProFeaturesModal
            visible={isProFeaturesVisible}
            darkMode={darkMode}
            price={proPrice}
            onBuy={handleBuyPro}
            onClose={() => setIsProFeaturesVisible(false)}
            isPurchasing={isRevenueCatLoading}
          />
          </SafeAreaView>
        </Animated.View>
        {showAnimatedSplash && <AnimatedSplash darkMode={darkMode} onComplete={() => setShowAnimatedSplash(false)} />}
      </>
    );
  }

  return (
    <>
      <Animated.View key="game" entering={screenEntering} exiting={screenExiting} style={styles.screenTransition}>
        <SafeAreaView edges={["top", "left", "right"]} style={[styles.container, darkMode && styles.containerDark]}>
        <Stack.Screen options={{ statusBarStyle: darkMode && !isTrainingMode ? "light" : "dark", statusBarAnimation: "fade" }} />
        {isTrainingMode && <View pointerEvents="none" style={[styles.trainingTopInset, { height: insets.top }]} />}
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
              position: "absolute",
              top: insets.top + 60,
              alignSelf: "center",
              backgroundColor: terminal.panel,
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 2,
              zIndex: 100,
              borderWidth: 1,
              borderColor: terminal.amber,
            }}
          >
            <EmojiText style={{ color: terminal.amber, fontFamily: TERMINAL_FONT, fontSize: 12, fontWeight: "700" }}>🎮 SIGNED IN AS {gameCenterPlayer.displayName}</EmojiText>
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
          trainingMode={isTrainingMode}
          trainingReturnPercent={trainingReturn}
          trainingTrades={trainingTally.trades}
          trainingWins={trainingTally.wins}
          darkMode={darkMode}
          chartType={chartType}
          setChartType={applyChartType}
          openMenu={openMenuScreen}
          openPatterns={() => setIsPatternSettingsVisible(true)}
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
          <View style={styles.floatingSpeed}>
            {/* Candle speed in ms: minus lowers it (faster), plus raises it (slower). */}
            <View style={styles.floatingSpeedButtons}>
              <UiButton
                title="−"
                onPress={() => setChartSpeedMs(clampSpeedMs(baseTickMs - SPEED_STEP_MS))}
                disabled={baseTickMs <= SPEED_MIN_MS}
                variant="bordered"
                controlSize="small"
                style={styles.floatingSpeedButton}
                darkMode={darkMode}
              />
              <View style={[styles.floatingSpeedValue, { borderColor: terminal.amber, backgroundColor: darkMode ? terminal.bg : terminal.panel }]}>
                <Text style={[styles.floatingSpeedValueText, { color: terminal.amber }]}>{baseTickMs}ms</Text>
              </View>
              <UiButton
                title="+"
                onPress={() => setChartSpeedMs(clampSpeedMs(baseTickMs + SPEED_STEP_MS))}
                disabled={baseTickMs >= SPEED_MAX_MS}
                variant="bordered"
                controlSize="small"
                style={styles.floatingSpeedButton}
                darkMode={darkMode}
              />
            </View>
          </View>
          {typeof roundSecondsRemaining === "number" && <RoundTimer seconds={roundSecondsRemaining} darkMode={darkMode} />}
          {isFiveTradesMode && (
            <View pointerEvents="none" style={[styles.floatingTradeCounter, darkMode && styles.floatingTradeCounterDark]}>
              {/* Remounts per trade so the counter pops each time it ticks up. */}
              <Animated.View key={roundTradesMade} entering={roundTradesMade > 0 ? popIn : undefined}>
                <Text style={[styles.floatingTradeCounterText, darkMode && styles.floatingTradeCounterTextDark]}>
                  Trades: {Math.min(roundTradesMade, FIVE_TRADES_TARGET)}/{FIVE_TRADES_TARGET}
                </Text>
              </Animated.View>
            </View>
          )}
          <View style={styles.floatingFollowContainer}>
            <View style={styles.floatingZoomButtons}>
              {!isChartFollowing && (
                <UiButton
                  title="Follow"
                  onPress={resetChartView}
                  variant="borderedProminent"
                  color={terminal.blue}
                  controlSize="small"
                  style={styles.floatingFollowButton}
                  darkMode={darkMode}
                />
              )}
              <UiButton
                title="1×"
                onPress={() => applyZoomOutPreset(1)}
                variant={zoomPreset === 1 ? "borderedProminent" : "bordered"}
                color={zoomPreset === 1 ? terminal.amber : undefined}
                controlSize="small"
                style={styles.floatingZoomButton}
                darkMode={darkMode}
              />
              <UiButton
                title="2×"
                onPress={() => applyZoomOutPreset(2)}
                variant={zoomPreset === 2 ? "borderedProminent" : "bordered"}
                color={zoomPreset === 2 ? terminal.amber : undefined}
                controlSize="small"
                style={styles.floatingZoomButton}
                darkMode={darkMode}
              />
              <UiButton
                title="3×"
                onPress={() => applyZoomOutPreset(3)}
                variant={zoomPreset === 3 ? "borderedProminent" : "bordered"}
                color={zoomPreset === 3 ? terminal.amber : undefined}
                controlSize="small"
                style={styles.floatingZoomButton}
                darkMode={darkMode}
              />
            </View>
          </View>
          <BottomControls
            darkMode={darkMode}
            useLeverage={useLeverage}
            toggleUseLeverage={toggleUseLeverage}
            overtime={isOvertime}
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
            disabled={
              // Training Wheels is playable: trades are scored in % and never touch the stack.
              isQuizMode ||
              isRoundResultsVisible ||
              isMarginCallVisible ||
              (!isOvertime && (isRoundEnded || (typeof roundSecondsRemaining === "number" && roundSecondsRemaining <= 0)))
            }
            styles={styles}
          />

          {!isTrainingMode && !isQuizMode && shouldShowInGameBanner && (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              pointerEvents="box-none"
              style={{ position: "absolute", top: 58, left: 12, right: 12, alignItems: "center", zIndex: 10 }}
            >
              <Pressable
                onPress={dismissInGameBanner}
                hitSlop={8}
                style={[styles.inGameBannerCloseButton, darkMode && styles.inGameBannerCloseButtonDark]}
              >
                <View style={styles.inGameBannerCloseGlyph}>
                  <View style={[styles.inGameBannerCloseLine, styles.inGameBannerCloseLineA, darkMode && styles.inGameBannerCloseLineDark]} />
                  <View style={[styles.inGameBannerCloseLine, styles.inGameBannerCloseLineB, darkMode && styles.inGameBannerCloseLineDark]} />
                </View>
              </Pressable>
              <Pressable
                disabled={showSpeedHint || showOvertimeHint || !showPatternLines || isTrainingMode}
                onPress={() => {
                  if (showPatternLines && !isTrainingMode) {
                    setShowPatternLines(false);
                    setStackBalance(initialStackBalance);
                    stackBalanceRef.current = initialStackBalance;
                  }
                }}
                onLayout={(e) => {
                  if (!showOvertimeHint) return;
                  const { width, height } = e.nativeEvent.layout;
                  if (width !== overtimeBannerLayout.width || height !== overtimeBannerLayout.height) {
                    setOvertimeBannerLayout({ width, height });
                  }
                }}
                style={[
                  styles.startHintContainer,
                  darkMode && styles.startHintContainerDark,
                  showOvertimeHint && styles.overtimeHintContainer,
                  { position: "relative", top: 0, left: 0, right: 0, width: "100%" },
                ]}
              >
                {showOvertimeHint && !!overtimeBurstTrigger && overtimeBannerLayout.width > 0 && overtimeBannerLayout.height > 0 ? (
                  <View pointerEvents="none" style={styles.overtimeBurstLayer}>
                    <RocketBurst
                      trigger={overtimeBurstTrigger}
                      darkMode={darkMode}
                      width={overtimeBannerLayout.width}
                      height={overtimeBannerLayout.height}
                    />
                  </View>
                ) : null}
                <View pointerEvents="none" style={styles.startHintCoins}>
                  {showSpeedHint || showOvertimeHint ? null : showPatternLines ? (
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
                <View style={[styles.startHintContent, { width: "100%", alignItems: "center" }]}>
                  <Text style={[styles.startHintKicker, darkMode && styles.startHintKickerDark, showOvertimeHint && styles.overtimeHintInk, { textAlign: "center" }]}>
                    {showOvertimeHint
                      ? "Let it run!"
                      : showSpeedHint
                        ? "Speed updated"
                        : showPatternLines
                          ? "Training Wheels ON"
                          : `Ready for ${modeLabel}?`}
                  </Text>
                  <Text style={[styles.startHintText, darkMode && styles.startHintTextDark, showOvertimeHint && styles.overtimeHintInk, { textAlign: "center" }]}>
                    {showOvertimeHint
                      ? "Close position to end game"
                      : showSpeedHint
                        ? speedHintText
                        : showPatternLines
                          ? isTrainingMode
                            ? "Training mode active"
                            : "Tap to turn off & start playing"
                          : isFiveTradesMode
                            ? "Hit BUY to start your 5-trade run!"
                            : "Hit BUY to start your 60s sprint!"}
                  </Text>
                </View>
              </Pressable>

              {!showSpeedHint && !showOvertimeHint && showPatternLines && currentPatternLabel && (
                <View style={styles.trainingFormingTag}>
                  <Text style={styles.trainingFormingTagText}>Forming: {currentPatternLabel}</Text>
                </View>
              )}
            </Animated.View>
          )}
          {isTrainingMode && showPatternLines && currentPatternLabel && (
            <Animated.View
              entering={FadeIn.duration(300)}
              exiting={FadeOut.duration(200)}
              pointerEvents="none"
              style={{ position: "absolute", top: 58, left: 12, right: 12, alignItems: "center", zIndex: 10 }}
            >
              <View style={styles.trainingFormingTag}>
                <Text style={styles.trainingFormingTagText}>Forming: {currentPatternLabel}</Text>
              </View>
            </Animated.View>
          )}
          {isQuizMode && (
            <View pointerEvents="none" style={{ position: "absolute", top: 58, left: 12, right: 12, alignItems: "center", zIndex: 10 }}>
              <PopQuizScoreTag score={quizScore} darkMode={darkMode} />
            </View>
          )}
          {isQuizMode && quizPrompt && (
            <View pointerEvents="box-none" style={{ position: "absolute", left: 12, right: 12, bottom: 12, zIndex: 20 }}>
              <PopQuizCard prompt={quizPrompt} score={quizScore} darkMode={darkMode} onAnswer={answerQuiz} onContinue={resumeQuizMarket} />
            </View>
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
        <MarginCallOverlay visible={isMarginCallVisible} darkMode={darkMode} variant={marginCallVariant} onTryAgain={resetRun} />
        <PatternSettingsModal
          visible={isPatternSettingsVisible}
          darkMode={darkMode}
          patterns={allPatterns}
          enabledPatternIds={enabledPatternIds}
          togglePattern={togglePattern}
          showPatternLines={showPatternLines}
          onTogglePatternLines={() => {
            if (isTrainingMode || isQuizMode) {
              return;
            }
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
        <ProFeaturesModal
          visible={isProFeaturesVisible}
          darkMode={darkMode}
          price={proPrice}
          onBuy={handleBuyPro}
          onClose={() => setIsProFeaturesVisible(false)}
          isPurchasing={isRevenueCatLoading}
        />
        </SafeAreaView>
      </Animated.View>
      {showAnimatedSplash && <AnimatedSplash darkMode={darkMode} onComplete={() => setShowAnimatedSplash(false)} />}
    </>
  );
}

export default function Index() {
  return <AppContent />;
}

const styles = StyleSheet.create({
  screenTransition: {
    flex: 1,
    overflow: "hidden",
  },
  container: {
    flex: 1,
    backgroundColor: TERMINAL_LIGHT.bg,
  },
  containerDark: {
    backgroundColor: TERMINAL_DARK.bg,
  },
  chartWrapper: {
    flex: 1,
    paddingBottom: 20,
  },
  webView: {
    flex: 1,
  },
  stackBar: {
    minHeight: 56,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: TERMINAL_LIGHT.amber,
    backgroundColor: TERMINAL_LIGHT.panel,
  },
  stackBarDark: {
    borderBottomColor: TERMINAL_DARK.amber,
    backgroundColor: TERMINAL_DARK.bg,
  },
  stackBarTraining: {
    borderBottomColor: "#000000",
    backgroundColor: TERMINAL_DARK.yellow,
  },
  trainingTopInset: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: TERMINAL_DARK.yellow,
  },
  stackLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stackLabel: {
    fontFamily: TERMINAL_FONT,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: TERMINAL_LIGHT.amber,
  },
  stackLabelDark: {
    color: TERMINAL_DARK.amber,
  },
  stackValue: {
    fontFamily: TERMINAL_FONT,
    fontSize: 20,
    fontWeight: "700",
    color: TERMINAL_LIGHT.text,
  },
  stackValueDark: {
    color: TERMINAL_DARK.text,
  },
  stackTrainingWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stackTrainingText: {
    flexShrink: 1,
    fontFamily: TERMINAL_FONT,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#000000",
  },
  stackTrainingTextDark: {
    color: "#000000",
  },
  stackTrainingLabel: {
    color: "#000000",
  },
  stackTrainingValue: {
    color: "#000000",
  },
  stackBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  stackWager: {
    alignItems: "flex-end",
  },
  stackWagerLabel: {
    fontFamily: TERMINAL_FONT,
    fontSize: 10,
    color: TERMINAL_LIGHT.amber,
  },
  stackWagerLabelDark: {
    color: TERMINAL_DARK.amber,
  },
  stackWagerValue: {
    fontFamily: TERMINAL_FONT,
    fontSize: 14,
    fontWeight: "700",
    color: TERMINAL_LIGHT.green,
  },
  stackWagerValueDark: {
    color: TERMINAL_DARK.green,
  },
  settingsButton: {
    width: 36,
    height: 36,
    minHeight: 36,
    paddingHorizontal: 0,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  settingsButtonDark: {
    backgroundColor: "transparent",
  },
  menuBurgerGlyph: {
    width: 14,
    height: 12,
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuBurgerLine: {
    width: 14,
    height: 2,
    backgroundColor: TERMINAL_LIGHT.text,
  },
  menuBurgerLineDark: {
    backgroundColor: TERMINAL_DARK.amber,
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
  floatingFollowContainer: {
    position: "absolute",
    bottom: 158,
    right: 44,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  floatingZoomButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    marginRight: 6,
  },
  floatingZoomButton: {
    height: 28,
    minHeight: 28,
    width: 44,
    paddingHorizontal: 0,
    borderRadius: 2,
  },
  floatingFollowButton: {
    height: 28,
    minHeight: 28,
    width: 78,
    paddingHorizontal: 0,
    borderRadius: 2,
  },
  floatingSpeed: {
    position: "absolute",
    top: 12,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 11,
  },
  floatingSpeedButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  floatingSpeedButton: {
    height: 28,
    minHeight: 28,
    width: 40,
    paddingHorizontal: 0,
    borderRadius: 2,
  },
  floatingSpeedValue: {
    height: 28,
    width: 80,
    borderWidth: 1,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingSpeedValueText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  floatingTradeCounter: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  floatingTradeCounterDark: {},
  floatingTradeCounterText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: TERMINAL_LIGHT.amber,
    backgroundColor: TERMINAL_LIGHT.panel,
    borderWidth: 1,
    borderColor: TERMINAL_LIGHT.amber,
    paddingHorizontal: 12,
    paddingVertical: 5,
    overflow: "hidden",
  },
  floatingTradeCounterTextDark: {
    color: TERMINAL_DARK.amber,
    backgroundColor: TERMINAL_DARK.bg,
    borderColor: TERMINAL_DARK.amber,
  },
  launchMenu: {
    flex: 1,
    width: "100%",
  },
  launchMenuContent: {
    flexGrow: 1,
  },
  terminalHeader: {
    height: LAUNCH_MENU_HEADER_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  terminalHeaderBrand: {
    fontFamily: TERMINAL_FONT,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 3,
  },
  terminalHeaderMeta: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  launchMenuButton: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  launchMenuCode: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  launchMenuCodeText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 18,
    fontWeight: "900",
  },
  launchMenuTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  launchMenuGo: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  launchMenuTitle: {
    fontFamily: TERMINAL_FONT,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  launchMenuTitleCompact: {
    fontSize: 18,
  },
  launchMenuSubtitle: {
    marginTop: 4,
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "500",
  },
  settingsScreen: {
    flex: 1,
    backgroundColor: TERMINAL_LIGHT.bg,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  settingsScreenDark: {
    backgroundColor: TERMINAL_DARK.bg,
  },
  settingsSafeArea: {
    backgroundColor: TERMINAL_LIGHT.bg,
  },
  settingsSafeAreaDark: {
    backgroundColor: TERMINAL_DARK.bg,
  },
  settingsHeaderRow: {
    alignItems: "flex-start",
    marginBottom: 10,
  },
  settingsContentWidth: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  settingsHeaderBlock: {
    marginBottom: 14,
    paddingHorizontal: 4,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: TERMINAL_DARK.amber,
  },
  settingsTitle: {
    fontFamily: TERMINAL_FONT,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: TERMINAL_LIGHT.text,
  },
  settingsTitleDark: {
    color: TERMINAL_DARK.amber,
  },
  settingsSubtitle: {
    marginTop: 6,
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "500",
    color: TERMINAL_LIGHT.textDim,
  },
  settingsSubtitleDark: {
    color: TERMINAL_DARK.textDim,
  },
  settingsScroll: {
    flex: 1,
  },
  settingsScrollContent: {
    paddingBottom: 28,
    alignItems: "center",
  },
  settingsSection: {
    width: "100%",
    maxWidth: 720,
    marginBottom: 16,
  },
  settingsSectionTitle: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    fontWeight: "800",
    color: TERMINAL_LIGHT.amber,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
    marginLeft: 2,
  },
  settingsSectionTitleDark: {
    color: TERMINAL_DARK.amber,
  },
  settingsCard: {
    borderRadius: 2,
    backgroundColor: TERMINAL_LIGHT.panel,
    borderWidth: 1,
    borderColor: TERMINAL_LIGHT.border,
    overflow: "hidden",
  },
  settingsCardDark: {
    backgroundColor: TERMINAL_DARK.panel,
    borderColor: TERMINAL_DARK.border,
  },
  settingsRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingsRowDark: {
    backgroundColor: TERMINAL_DARK.panel,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: TERMINAL_LIGHT.border,
  },
  settingsRowBorderDark: {
    borderBottomColor: TERMINAL_DARK.border,
  },
  settingsRowPressed: {
    backgroundColor: TERMINAL_LIGHT.panelAlt,
  },
  settingsRowPressedDark: {
    backgroundColor: TERMINAL_DARK.panelAlt,
  },
  settingsRowLeading: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsRowIconWrap: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsRowTextWrap: {
    flex: 1,
    gap: 3,
  },
  settingsRowLabel: {
    fontFamily: TERMINAL_FONT,
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    color: TERMINAL_LIGHT.text,
  },
  settingsRowLabelDark: {
    color: TERMINAL_DARK.text,
  },
  settingsRowSubtitle: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    fontWeight: "500",
    color: TERMINAL_LIGHT.textDim,
  },
  settingsRowSubtitleDark: {
    color: TERMINAL_DARK.textDim,
  },
  settingsRowChevron: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "800",
    color: TERMINAL_LIGHT.amber,
  },
  settingsRowChevronDark: {
    color: TERMINAL_DARK.amber,
  },
  dailyQuoteScreen: {
    flex: 1,
  },
  dailyQuoteHeaderMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  dailyQuoteScroll: {
    flex: 1,
  },
  dailyQuoteContent: {
    flexGrow: 1,
    width: "100%",
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: "center",
  },
  dailyQuoteFooter: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 8,
  },
  dailyQuoteStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dailyQuoteActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dailyQuoteHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  dailyQuoteHeaderBack: {
    borderWidth: 1,
    borderRadius: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  dailyQuoteHeaderBackText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  dailyQuoteHeaderBrand: {
    fontSize: 15,
    letterSpacing: 2,
    flexShrink: 1,
  },
  dailyQuotePaperStage: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 640,
  },
  dailyQuotePaperCover: {
    position: "absolute",
    top: -6,
    bottom: -20,
    left: 0,
  },
  dailyQuotePaperRoll: {
    position: "absolute",
    top: -5,
    bottom: -5,
    left: 0,
    width: QUOTE_ROLL_WIDTH,
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 2, height: 2 },
  },
  dailyQuotePaperRollBody: {
    flex: 1,
    borderRadius: QUOTE_ROLL_WIDTH / 2,
    overflow: "hidden",
  },
  dailyQuotePaper: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 640,
    borderRadius: 3,
    shadowColor: "#000000",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: "#f5f0e1",
    borderWidth: 1,
    borderColor: "#ddd4c0",
  },
  dailyQuotePaperCompact: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  dailyQuotePaperDark: {
    backgroundColor: "#201d18",
    borderColor: "#4a4438",
  },
  dailyQuoteTopRule: {
    height: 4,
    backgroundColor: "#1a1a1a",
    marginBottom: 2,
  },
  dailyQuoteTopRuleDark: {
    backgroundColor: "#e4d9c2",
  },
  dailyQuoteTopRuleThin: {
    height: 1,
    backgroundColor: "#1a1a1a",
    marginBottom: 14,
  },
  dailyQuoteTopRuleThinDark: {
    backgroundColor: "#e4d9c2",
  },
  dailyQuoteMasthead: {
    fontSize: 34,
    letterSpacing: 2,
    fontWeight: "900",
    fontFamily: "Georgia",
    color: "#1a1a1a",
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  dailyQuoteMastheadDark: {
    color: "#f2e6ce",
  },
  dailyQuoteDateLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    gap: 10,
  },
  dailyQuoteDateDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "#1a1a1a",
  },
  dailyQuoteDateDividerDark: {
    backgroundColor: "#d6c8ac",
  },
  dailyQuoteDate: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    color: "#555555",
  },
  dailyQuoteDateDark: {
    color: "#c7b899",
  },
  dailyQuoteHeadlineWrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  dailyQuoteHeadline: {
    fontWeight: "600",
    fontFamily: "Georgia",
    color: "#1f1f1f",
    textAlign: "center",
  },
  dailyQuoteHeadlineDark: {
    color: "#f2e7d2",
  },
  dailyQuoteHeadlineRule: {
    width: 92,
    height: 3,
    backgroundColor: "#1a1a1a",
    marginTop: 12,
  },
  dailyQuoteHeadlineRuleDark: {
    backgroundColor: "#d6c8ac",
  },
  dailyQuoteByline: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#666666",
    textAlign: "center",
    textTransform: "uppercase",
  },
  dailyQuoteBylineDark: {
    color: "#c7b899",
  },
  dailyQuoteBylineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  dailyQuoteUnconfirmedStamp: {
    borderWidth: 1.5,
    borderColor: "#a3241b",
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    transform: [{ rotate: "-4deg" }],
  },
  dailyQuoteUnconfirmedStampDark: {
    borderColor: "#e0675a",
  },
  dailyQuoteUnconfirmedText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: "#a3241b",
    textTransform: "uppercase",
  },
  dailyQuoteUnconfirmedTextDark: {
    color: "#e0675a",
  },
  dailyQuoteSource: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 14,
    fontStyle: "italic",
    color: "#777064",
    textAlign: "center",
  },
  dailyQuoteSourceDark: {
    color: "#a99d87",
  },
  dailyQuoteMoneyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dailyQuoteMoneyIconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  dailyQuoteDropCash: {
    position: "absolute",
    top: 7,
    left: 7,
    right: 7,
    bottom: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  dailyQuoteStackLabel: {
    fontFamily: TERMINAL_FONT,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  dailyQuoteMoneyText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 20,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  dailyQuoteLockButton: {
    flex: 2,
  },
  dailyQuoteClaimHint: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    textAlign: "center",
  },
  dailyQuoteBuyProButton: {
    flex: 1,
  },
  dailyQuoteProCounter: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
  },
  dailyQuoteProCounterText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
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
    backgroundColor: TERMINAL_LIGHT.panel,
    borderBottomWidth: 2,
    borderColor: TERMINAL_LIGHT.amber,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 6,
    overflow: "hidden",
  },

  startHintContainer: {
    position: "absolute",
    top: 10,
    left: 12,
    right: 12,
    backgroundColor: TERMINAL_LIGHT.panel,
    borderWidth: 1,
    borderColor: TERMINAL_LIGHT.amber,
    borderLeftWidth: 4,
    borderRadius: 2,
    paddingVertical: 18,
    paddingHorizontal: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
    overflow: "hidden",
  },
  startHintContainerDark: {
    backgroundColor: TERMINAL_DARK.panel,
    borderColor: TERMINAL_DARK.amber,
  },
  inGameBannerCloseButton: {
    position: "absolute",
    top: 10,
    right: 18,
    width: 26,
    height: 26,
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TERMINAL_LIGHT.amber,
    zIndex: 12,
  },
  inGameBannerCloseButtonDark: {
    backgroundColor: TERMINAL_DARK.amber,
  },
  inGameBannerCloseGlyph: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  inGameBannerCloseLine: {
    position: "absolute",
    width: 12,
    height: 2,
    backgroundColor: "#000000",
  },
  inGameBannerCloseLineA: {
    transform: [{ rotate: "45deg" }],
  },
  inGameBannerCloseLineB: {
    transform: [{ rotate: "-45deg" }],
  },
  inGameBannerCloseLineDark: {
    backgroundColor: "#000000",
  },
  trainingFormingTag: {
    marginTop: 8,
    backgroundColor: "#000000",
    borderWidth: 1,
    borderColor: TERMINAL_DARK.yellow,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 2,
  },
  trainingFormingTagText: {
    color: TERMINAL_DARK.yellow,
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  overtimeHintInk: {
    color: "#000000",
  },
  overtimeHintContainer: {
    backgroundColor: TERMINAL_DARK.amber,
    borderColor: "#000000",
  },
  startHintContent: {
    alignItems: "center",
    zIndex: 2,
  },
  overtimeBurstLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  startHintKicker: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    fontWeight: "800",
    color: TERMINAL_LIGHT.amber,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  startHintKickerDark: {
    color: TERMINAL_DARK.amber,
  },
  startHintText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 16,
    fontWeight: "800",
    color: TERMINAL_LIGHT.text,
    textAlign: "center",
  },
  startHintTextDark: {
    color: TERMINAL_DARK.text,
  },
  startHintCoins: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
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
    backgroundColor: TERMINAL_DARK.bg,
    borderColor: TERMINAL_DARK.amber,
  },
  profitToastContent: {
    width: "100%",
    paddingTop: 10,
    paddingBottom: 18,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  profitToastKicker: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "800",
    color: TERMINAL_LIGHT.amber,
    letterSpacing: 1,
    textTransform: "uppercase",
    width: "100%",
    textAlign: "center",
  },
  profitToastKickerDark: {
    color: TERMINAL_DARK.amber,
  },
  profitToastBigValue: {
    marginTop: 6,
    fontFamily: TERMINAL_FONT,
    fontSize: 50,
    fontWeight: "800",
    color: TERMINAL_LIGHT.green,
    textAlign: "center",
  },
  profitToastBigValueDark: {
    color: TERMINAL_DARK.green,
  },
  profitToastBigValueLoss: {
    color: TERMINAL_LIGHT.red,
  },
  profitToastBigValueFlat: {
    color: TERMINAL_LIGHT.textDim,
  },
  profitToastBigValueLiquidation: {
    color: TERMINAL_LIGHT.red,
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
    bottom: Platform.OS === "android" ? 10 : 0,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "android" ? 6 : 0,
    gap: TRADE_BAR_GAP,
    // On wide screens (iPad, unfolded iPhone Duo) keep the controls thumb-sized and centered.
    alignItems: "center",
  },
  wagerBar: {
    width: "100%",
    maxWidth: TRADE_CONTROLS_MAX_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 4,
    backgroundColor: TERMINAL_LIGHT.panel,
    borderWidth: 1,
    borderRadius: 2,
    borderColor: TERMINAL_LIGHT.border,
  },
  wagerBarDark: {
    backgroundColor: TERMINAL_DARK.bg,
    borderColor: TERMINAL_DARK.border,
  },
  wagerPicker: {
    flex: 1,
    height: 36,
  },
  wagerModeButton: {
    width: 112,
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
    width: "100%",
    maxWidth: TRADE_CONTROLS_MAX_WIDTH,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  tradeButton: {
    flex: 1,
    height: 54,
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
