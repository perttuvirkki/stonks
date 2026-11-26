import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { getLocalDayKey, useGameStore, type DailyPnl } from "../stores/useGameStore";
import { UiButton } from "./UiButton";
import { TERMINAL_FONT, getTerminalPalette } from "../theme/terminal";

type PnlCalendarModalProps = {
  visible: boolean;
  darkMode: boolean;
  onClose: () => void;
};

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MAX_WIDTH = 720;

/** "+$2.3K" style: short enough for a seventh of a phone screen. */
const formatCompact = (n: number) => {
  const abs = Math.abs(n);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}$${Math.round(abs)}`;
};

const formatMoney = (n: number) => `${n > 0 ? "+" : n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const tradesLabel = (count: number) => `${count} trade${count === 1 ? "" : "s"}`;

type Cell = { key: string; day: number; inMonth: boolean };

/** Six weeks starting on the Sunday on or before the 1st, like a wall calendar. */
const buildMonthCells = (year: number, month: number): Cell[] => {
  const start = new Date(year, month, 1);
  start.setDate(1 - start.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return { key: getLocalDayKey(date), day: date.getDate(), inMonth: date.getMonth() === month };
  });
};

export const PnlCalendarModal = memo(({ visible, darkMode, onClose }: PnlCalendarModalProps) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const translateY = useSharedValue(windowHeight);
  const [rendered, setRendered] = useState(visible);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dailyPnl = useGameStore((state) => state.dailyPnl);

  const todayKey = getLocalDayKey();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedKey, setSelectedKey] = useState(todayKey);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  useEffect(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (visible) {
      // Always open on today.
      const now = new Date();
      setCursor({ year: now.getFullYear(), month: now.getMonth() });
      setSelectedKey(getLocalDayKey(now));
      setRendered(true);
      translateY.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
      return;
    }
    translateY.value = withTiming(windowHeight, { duration: 260, easing: Easing.in(Easing.cubic) });
    hideTimeoutRef.current = setTimeout(() => setRendered(false), 270);
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [translateY, visible, windowHeight]);

  const cells = useMemo(() => buildMonthCells(cursor.year, cursor.month), [cursor]);

  const monthTotals = useMemo(() => {
    const prefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-`;
    let pnl = 0;
    let trades = 0;
    let green = 0;
    let red = 0;
    for (const [key, value] of Object.entries(dailyPnl)) {
      if (!key.startsWith(prefix) || value.trades === 0) continue;
      pnl += value.pnl;
      trades += value.trades;
      if (value.pnl > 0) green += 1;
      else if (value.pnl < 0) red += 1;
    }
    return { pnl, trades, green, red };
  }, [cursor, dailyPnl]);

  const streak = useMemo(() => {
    // Consecutive green trading days ending today (or yesterday, if today has no trades yet).
    let count = 0;
    const date = new Date();
    if (!dailyPnl[getLocalDayKey(date)]) date.setDate(date.getDate() - 1);
    while ((dailyPnl[getLocalDayKey(date)]?.pnl ?? 0) > 0) {
      count += 1;
      date.setDate(date.getDate() - 1);
    }
    return count;
  }, [dailyPnl]);

  if (!rendered) {
    return null;
  }

  const palette = getTerminalPalette(darkMode);
  const greenTint = darkMode ? "rgba(37,208,125,0.16)" : "rgba(10,138,74,0.12)";
  const redTint = darkMode ? "rgba(255,75,75,0.16)" : "rgba(209,42,34,0.10)";
  const contentWidth = Math.min(windowWidth, MAX_WIDTH) - 32;
  const cellWidth = contentWidth / 7;
  const cellHeight = Math.max(56, Math.min(cellWidth * 1.2, 112));
  const amountSize = Math.max(10, Math.min(Math.floor(cellWidth / 5.2), 18));
  const monthLabel = new Date(cursor.year, cursor.month, 1)
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toUpperCase();
  const isCurrentMonth = (() => {
    const now = new Date();
    return now.getFullYear() === cursor.year && now.getMonth() === cursor.month;
  })();
  const shiftMonth = (delta: number) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const selected: DailyPnl | undefined = dailyPnl[selectedKey];
  const [selYear, selMonth, selDay] = selectedKey.split("-").map(Number);
  const selectedLabel = new Date(selYear, selMonth - 1, selDay)
    .toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();
  const pnlColor = (n: number) => (n > 0 ? palette.green : n < 0 ? palette.red : palette.textDim);

  return (
    <Animated.View style={[styles.overlay, animatedStyle, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: palette.bg }]}>
        <View style={[styles.headerBar, { backgroundColor: palette.header }]}>
          <Text style={[styles.headerBrand, { color: palette.headerText }]}>PNL CALENDAR</Text>
          <Text style={[styles.headerMeta, { color: palette.headerText }]}>
            {streak > 0 ? `${streak}D GREEN STREAK` : "DAILY P&L"}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.monthRow}>
          <Pressable accessibilityLabel="Previous month" hitSlop={12} onPress={() => shiftMonth(-1)} style={styles.navButton}>
            <Text style={[styles.navText, { color: palette.amber }]}>&lt;</Text>
          </Pressable>
          <Text style={[styles.monthLabel, { color: palette.text }]}>{monthLabel}</Text>
          <Pressable
            accessibilityLabel="Next month"
            hitSlop={12}
            disabled={isCurrentMonth}
            onPress={() => shiftMonth(1)}
            style={[styles.navButton, isCurrentMonth && styles.navDisabled]}
          >
            <Text style={[styles.navText, { color: palette.amber }]}>&gt;</Text>
          </Pressable>
        </View>

        <View style={[styles.summary, { borderColor: palette.border, backgroundColor: palette.panel }]}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: palette.amber }]}>MONTHLY P&amp;L</Text>
            <Text style={[styles.summaryValue, { color: pnlColor(monthTotals.pnl) }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(monthTotals.pnl)}
            </Text>
          </View>
          <View style={styles.summaryItemRight}>
            <Text style={[styles.summaryLabel, { color: palette.amber }]}>DAYS</Text>
            <Text style={[styles.summaryDays, { color: palette.text }]}>
              <Text style={{ color: palette.green }}>{monthTotals.green}W</Text>
              {" / "}
              <Text style={{ color: palette.red }}>{monthTotals.red}L</Text>
            </Text>
          </View>
        </View>

        <View style={[styles.grid, { borderColor: palette.borderStrong }]}>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((label, index) => (
              <View key={`${label}-${index}`} style={[styles.weekdayCell, { width: cellWidth, borderColor: palette.border, backgroundColor: palette.panelAlt }]}>
                <Text style={[styles.weekdayText, { color: palette.textDim }]}>{label}</Text>
              </View>
            ))}
          </View>
          {Array.from({ length: 6 }, (_, week) => (
            <View key={week} style={styles.weekRow}>
              {cells.slice(week * 7, week * 7 + 7).map((cell) => {
                const entry = cell.inMonth ? dailyPnl[cell.key] : undefined;
                const hasTrades = !!entry && entry.trades > 0;
                const isToday = cell.key === todayKey;
                const isSelected = cell.key === selectedKey && cell.inMonth;
                const tint = hasTrades ? (entry!.pnl >= 0 ? greenTint : redTint) : "transparent";
                return (
                  <Pressable
                    key={cell.key}
                    disabled={!cell.inMonth}
                    onPress={() => setSelectedKey(cell.key)}
                    style={[
                      styles.dayCell,
                      { width: cellWidth, height: cellHeight, borderColor: palette.border, backgroundColor: tint },
                      isSelected && { borderColor: palette.amber, borderWidth: 2 },
                    ]}
                  >
                    <View style={[styles.dayNumberWrap, isToday && { backgroundColor: palette.amber }]}>
                      <Text
                        style={[
                          styles.dayNumber,
                          { color: cell.inMonth ? palette.text : palette.border },
                          isToday && { color: palette.headerText === "#000000" ? "#000000" : palette.bg },
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                    {hasTrades && (
                      <>
                        <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.dayAmount, { fontSize: amountSize, color: pnlColor(entry!.pnl) }]}>
                          {formatCompact(entry!.pnl)}
                        </Text>
                        <Text numberOfLines={1} style={[styles.dayTrades, { color: palette.textDim }]}>
                          {entry!.trades}T
                        </Text>
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={[styles.detail, { borderColor: palette.border, backgroundColor: palette.panel }]}>
          <Text style={[styles.detailDate, { color: palette.textDim }]}>{selectedLabel}</Text>
          {selected && selected.trades > 0 ? (
            <Text style={[styles.detailValue, { color: pnlColor(selected.pnl) }]} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(selected.pnl)} <Text style={[styles.detailTrades, { color: palette.textDim }]}>({tradesLabel(selected.trades)})</Text>
            </Text>
          ) : (
            <Text style={[styles.detailEmpty, { color: palette.textDim }]}>No trades. Cash is a position.</Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 12) }]}>
        <UiButton title="Close" onPress={onClose} variant="borderedProminent" color={palette.amber} controlSize="large" darkMode={darkMode} />
      </View>
    </Animated.View>
  );
});

PnlCalendarModal.displayName = "PnlCalendarModal";

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  header: {
    width: "100%",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBrand: {
    fontFamily: TERMINAL_FONT,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 2,
  },
  headerMeta: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  navButton: {
    width: 44,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  navDisabled: {
    opacity: 0.25,
  },
  navText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 24,
    fontWeight: "900",
  },
  monthLabel: {
    fontFamily: TERMINAL_FONT,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
    paddingRight: 12,
  },
  summaryItemRight: {
    alignItems: "flex-end",
  },
  summaryLabel: {
    fontFamily: TERMINAL_FONT,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryValue: {
    fontFamily: TERMINAL_FONT,
    fontSize: 26,
    fontWeight: "900",
  },
  summaryDays: {
    fontFamily: TERMINAL_FONT,
    fontSize: 18,
    fontWeight: "800",
  },
  grid: {
    borderWidth: 1,
  },
  weekRow: {
    flexDirection: "row",
  },
  weekdayCell: {
    alignItems: "center",
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  weekdayText: {
    fontFamily: TERMINAL_FONT,
    fontSize: 13,
    fontWeight: "800",
  },
  dayCell: {
    alignItems: "center",
    paddingTop: 6,
    paddingHorizontal: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dayNumberWrap: {
    minWidth: 26,
    height: 22,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontFamily: TERMINAL_FONT,
    fontSize: 14,
    fontWeight: "800",
  },
  dayAmount: {
    fontFamily: TERMINAL_FONT,
    fontWeight: "900",
    marginTop: 4,
  },
  dayTrades: {
    fontFamily: TERMINAL_FONT,
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },
  detail: {
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  detailDate: {
    fontFamily: TERMINAL_FONT,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  detailValue: {
    fontFamily: TERMINAL_FONT,
    fontSize: 24,
    fontWeight: "900",
  },
  detailTrades: {
    fontSize: 15,
    fontWeight: "700",
  },
  detailEmpty: {
    fontFamily: TERMINAL_FONT,
    fontSize: 14,
    fontWeight: "600",
  },
  footer: {
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
});
