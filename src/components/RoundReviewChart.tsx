import { memo, useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import Svg, { G, Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import TwemojiSkull from "../../assets/twemoji/1f480.svg";
import type { PatternLineKind } from "../types";
import { tradeReturnPercent, type ReviewCallout, type RoundReviewData } from "../review/roundReview";

const UP = "#26a69a";
const DOWN = "#ef5350";
const LINE_COLORS: Record<PatternLineKind, string> = {
  support: "#1a9f7a",
  resistance: "#d94b4b",
  neckline: "#3b82f6",
  target: "#f5a524",
  guide: "#9aa0a6",
};
const PATTERN_TINT = { bullish: "#1a9f7a", bearish: "#d94b4b", neutral: "#9aa0a6" };

const MIN_SPACING = 5;
const PAD_TOP = 34;
const PAD_BOTTOM = 18;
const PAD_RIGHT = 56;

export type RoundReviewChartProps = {
  data: RoundReviewData;
  callouts: ReviewCallout[];
  width: number;
  height: number;
  darkMode: boolean;
};

// A static re-draw of the round: candles, the patterns that formed (zone, label and lines), every
// entry and exit, and a couple of meme-arrow callouts. Candles after the bell are faded: that's
// the market carrying on without you.
export const RoundReviewChart = memo(({ data, callouts, width, height, darkMode }: RoundReviewChartProps) => {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { candles, trades, patterns } = data;

  const layout = useMemo(() => {
    const first = candles[0]?.index ?? 0;
    const last = candles[candles.length - 1]?.index ?? 0;
    const count = Math.max(1, last - first + 1);
    const spacing = Math.max(MIN_SPACING, (width - PAD_RIGHT) / count);
    const contentWidth = Math.max(width, count * spacing + PAD_RIGHT);

    let min = Infinity;
    let max = -Infinity;
    for (const candle of candles) {
      min = Math.min(min, candle.low);
      max = Math.max(max, candle.high);
    }
    // Only stretch the scale for the liquidation line when it's close enough to matter.
    if (data.liquidationPrice !== null && Number.isFinite(min)) {
      const span = max - min;
      if (data.liquidationPrice > min - span * 0.5 && data.liquidationPrice < max + span * 0.5) {
        min = Math.min(min, data.liquidationPrice);
        max = Math.max(max, data.liquidationPrice);
      }
    }
    if (!Number.isFinite(min) || max - min < 1e-6) {
      min = (min || 1) * 0.99;
      max = (max || 1) * 1.01;
    }
    const plotHeight = height - PAD_TOP - PAD_BOTTOM;
    const x = (index: number) => (index - first) * spacing + spacing / 2;
    const y = (price: number) => PAD_TOP + ((max - price) / (max - min)) * plotHeight;
    return { first, last, spacing, contentWidth, x, y, min, max };
  }, [candles, data.liquidationPrice, height, width]);

  const { x, y, spacing, contentWidth, first, last } = layout;
  const bodyWidth = Math.max(2, spacing * 0.62);
  const muted = darkMode ? "#8b9098" : "#888888";
  const grid = darkMode ? "#1f2329" : "#f0f0f0";
  const surface = darkMode ? "#0d0f12" : "#ffffff";

  const lineSegments = (points: { index: number; price: number }[], endIndex: number) => {
    // Extend the last leg straight out to where the game stopped drawing it.
    const visible = points.map((point) => ({ ...point }));
    const lastPoint = visible[visible.length - 1];
    const prev = visible[visible.length - 2];
    if (prev && lastPoint && endIndex > lastPoint.index && lastPoint.index !== prev.index) {
      const slope = (lastPoint.price - prev.price) / (lastPoint.index - prev.index);
      visible.push({ index: endIndex, price: lastPoint.price + slope * (endIndex - lastPoint.index) });
    }
    return visible
      .filter((point) => point.index >= first - 1 && point.index <= last + 1)
      .map((point) => `${x(point.index)},${y(point.price)}`)
      .join(" ");
  };

  const priceLabels = [layout.max, (layout.max + layout.min) / 2, layout.min];

  return (
    <View style={{ width, height }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        <View style={{ width: contentWidth, height }}>
          <Svg width={contentWidth} height={height}>
            {priceLabels.map((price, i) => (
              <Line key={`grid-${i}`} x1={0} x2={contentWidth} y1={y(price)} y2={y(price)} stroke={grid} strokeWidth={1} />
            ))}

            {patterns.map((pattern) => {
              const from = Math.max(first, pattern.startIndex);
              const to = Math.min(last, pattern.formationEndIndex);
              if (to < from) {
                return null;
              }
              const tint = PATTERN_TINT[pattern.bias];
              return (
                <Rect
                  key={`zone-${pattern.id}-${pattern.startIndex}`}
                  x={x(from) - spacing / 2}
                  y={PAD_TOP - 6}
                  width={(to - from + 1) * spacing}
                  height={height - PAD_TOP - PAD_BOTTOM + 12}
                  fill={tint}
                  opacity={0.08}
                  rx={6}
                />
              );
            })}

            {data.roundEndIndex >= first && data.roundEndIndex < last && (
              <Rect
                x={x(data.roundEndIndex) + spacing / 2}
                y={0}
                width={x(last) - x(data.roundEndIndex) + spacing}
                height={height}
                fill={surface}
                opacity={0.55}
              />
            )}

            {candles.map((candle) => {
              const color = candle.close >= candle.open ? UP : DOWN;
              const cx = x(candle.index);
              const top = y(Math.max(candle.open, candle.close));
              const bottom = y(Math.min(candle.open, candle.close));
              const faded = candle.index > data.roundEndIndex;
              return (
                <G key={candle.index}>
                  <Line x1={cx} x2={cx} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth={1} opacity={faded ? 0.35 : 1} />
                  <Rect
                    x={cx - bodyWidth / 2}
                    y={top}
                    width={bodyWidth}
                    height={Math.max(1, bottom - top)}
                    fill={color}
                    opacity={faded ? 0.35 : 1}
                  />
                </G>
              );
            })}

            {patterns.flatMap((pattern) =>
              pattern.lines.map((line) => {
                const points = lineSegments(line.points, line.endIndex);
                if (!points.includes(" ")) {
                  return null;
                }
                return (
                  <Polyline
                    key={`line-${pattern.startIndex}-${line.id}`}
                    points={points}
                    fill="none"
                    stroke={LINE_COLORS[line.kind]}
                    strokeWidth={line.kind === "guide" ? 1 : 2}
                    strokeDasharray={line.kind === "target" ? "6,4" : line.kind === "guide" ? "2,3" : undefined}
                  />
                );
              }),
            )}

            {data.liquidationPrice !== null && data.liquidationPrice >= layout.min && data.liquidationPrice <= layout.max && (
              <>
                <Line
                  x1={0}
                  x2={contentWidth}
                  y1={y(data.liquidationPrice)}
                  y2={y(data.liquidationPrice)}
                  stroke={DOWN}
                  strokeWidth={1}
                  strokeDasharray="4,4"
                />
              </>
            )}

            {data.roundEndIndex >= first && data.roundEndIndex <= last && (
              <>
                <Line
                  x1={x(data.roundEndIndex) + spacing / 2}
                  x2={x(data.roundEndIndex) + spacing / 2}
                  y1={PAD_TOP - 14}
                  y2={height - PAD_BOTTOM + 6}
                  stroke={muted}
                  strokeWidth={1}
                  strokeDasharray="3,3"
                />
                <SvgText x={x(data.roundEndIndex) + spacing / 2 + 4} y={height - 4} fill={muted} fontSize={10} fontWeight="700">
                  {data.liquidated ? "rekt" : "bell"}
                </SvgText>
              </>
            )}

            {trades.map((trade, i) => {
              const won = tradeReturnPercent(trade) > 0;
              const color = trade.outcome === "liquidated" ? DOWN : won ? UP : trade.exitPrice === null ? muted : DOWN;
              const ex = trade.exitIndex !== null ? x(trade.exitIndex) : null;
              const ey = trade.exitPrice !== null ? y(trade.exitPrice) : null;
              const entryX = x(trade.entryIndex);
              const entryY = y(trade.entryPrice);
              const labelAbove = trade.side === "short";
              return (
                <G key={`trade-${i}`}>
                  {ex !== null && ey !== null && (
                    <Line x1={entryX} y1={entryY} x2={ex} y2={ey} stroke={color} strokeWidth={1.5} strokeDasharray="3,2" />
                  )}
                  <Rect x={entryX - 4} y={entryY - 4} width={8} height={8} rx={4} fill={trade.side === "short" ? DOWN : UP} stroke={surface} strokeWidth={1.5} />
                  {ex !== null && ey !== null && trade.outcome !== "liquidated" && (
                    <Rect x={ex - 3.5} y={ey - 3.5} width={7} height={7} fill={color} stroke={surface} strokeWidth={1.5} />
                  )}
                  <SvgText
                    x={entryX}
                    y={labelAbove ? entryY - 9 : entryY + 16}
                    fill={trade.side === "short" ? DOWN : UP}
                    fontSize={10}
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {`${trade.side === "short" ? "S" : "L"}${trade.spot ? "" : trade.leverage}`}
                  </SvgText>
                </G>
              );
            })}
          </Svg>

          {patterns.map((pattern) => {
            const from = Math.max(first, pattern.startIndex);
            const to = Math.min(last, pattern.formationEndIndex);
            if (to < from) {
              return null;
            }
            // Anchored to the zone's right edge: the chart opens scrolled to the end, so that's the part on screen.
            const zoneWidth = Math.max(140, (to - from + 1) * spacing);
            return (
              <View
                key={`label-${pattern.id}-${pattern.startIndex}`}
                pointerEvents="none"
                style={[styles.patternLabelWrap, { left: x(to) + spacing / 2 - zoneWidth, width: zoneWidth - 6 }]}
              >
                <Text numberOfLines={1} style={[styles.patternLabel, { color: PATTERN_TINT[pattern.bias] }]}>
                  {pattern.label} {pattern.bias === "bullish" ? "↗" : pattern.bias === "bearish" ? "↘" : "→"}
                </Text>
              </View>
            );
          })}

          {trades
            .filter((trade) => trade.outcome === "liquidated" && trade.exitIndex !== null && trade.exitPrice !== null)
            .map((trade, i) => (
              <View key={`skull-${i}`} pointerEvents="none" style={[styles.skull, { left: x(trade.exitIndex!) - 11, top: y(trade.exitPrice!) - 11 }]}>
                <TwemojiSkull width={22} height={22} />
              </View>
            ))}

          {placeCallouts(callouts, x, y, height).map(({ callout, cx, cy, below }, i) => {
            const background = callout.tone === "bad" ? DOWN : callout.tone === "good" ? UP : darkMode ? "#2b2f35" : "#333333";
            return (
              <View
                key={`callout-${i}`}
                pointerEvents="none"
                style={[styles.callout, { left: cx - CALLOUT_WIDTH / 2, top: below ? cy + 22 : cy - 48 }]}
              >
                {!below && <View style={[styles.calloutBubble, { backgroundColor: background }]}><Text style={styles.calloutText}>{callout.text}</Text></View>}
                <Text style={[styles.calloutArrow, { color: background }]}>{below ? "▲" : "▼"}</Text>
                {below && <View style={[styles.calloutBubble, { backgroundColor: background }]}><Text style={styles.calloutText}>{callout.text}</Text></View>}
              </View>
            );
          })}
        </View>
      </ScrollView>
      <View pointerEvents="none" style={[styles.priceAxis, { backgroundColor: surface }]}>
        {priceLabels.map((price, i) => (
          <Text key={`price-${i}`} style={[styles.priceLabel, { top: y(price) - 7, color: muted }]}>
            {price.toFixed(price >= 100 ? 0 : 2)}
          </Text>
        ))}
        {data.liquidationPrice !== null && data.liquidationPrice >= layout.min && data.liquidationPrice <= layout.max && (
          <Text style={[styles.priceLabel, styles.liqLabel, { top: y(data.liquidationPrice) - 8 }]}>LIQ</Text>
        )}
      </View>
    </View>
  );
});

RoundReviewChart.displayName = "RoundReviewChart";

const CALLOUT_WIDTH = 140;

/** Puts each callout above or below its point, flipping it when it would cover the previous one. */
const placeCallouts = (callouts: ReviewCallout[], x: (index: number) => number, y: (price: number) => number, height: number) => {
  const placed: { callout: ReviewCallout; cx: number; cy: number; below: boolean }[] = [];
  for (const callout of callouts) {
    const cx = x(callout.index);
    const cy = y(callout.price);
    let below = cy < height / 2;
    const previous = placed[placed.length - 1];
    if (previous && Math.abs(previous.cx - cx) < CALLOUT_WIDTH && previous.below === below) {
      below = !below;
    }
    placed.push({ callout, cx, cy, below });
  }
  return placed;
};

const styles = StyleSheet.create({
  patternLabelWrap: {
    position: "absolute",
    top: 4,
    alignItems: "flex-end",
  },
  patternLabel: {
    fontSize: 11,
    fontWeight: "800",
  },
  liqLabel: {
    color: DOWN,
    fontWeight: "900",
  },
  skull: {
    position: "absolute",
  },
  callout: {
    position: "absolute",
    width: CALLOUT_WIDTH,
    alignItems: "center",
  },
  calloutBubble: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    transform: [{ rotate: "-3deg" }],
  },
  calloutText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  calloutArrow: {
    fontSize: 10,
    lineHeight: 12,
  },
  priceAxis: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 44,
    opacity: 0.92,
  },
  priceLabel: {
    position: "absolute",
    right: 4,
    fontSize: 10,
    fontWeight: "600",
  },
});
