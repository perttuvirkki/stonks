import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import TwemojiSkull from "../../assets/twemoji/1f480.svg";
import TwemojiPhone from "../../assets/twemoji/1f4de.svg";
import TwemojiSiren from "../../assets/twemoji/1f6a8.svg";
import { UiButton } from "./UiButton";

export type MarginCallVariant = "classic" | "incomingCall" | "breakingNews";

export type MarginCallOverlayProps = {
  visible: boolean;
  darkMode: boolean;
  variant?: MarginCallVariant;
  onTryAgain: () => void;
};

export const MarginCallOverlay = memo(({ visible, darkMode, variant = "classic", onTryAgain }: MarginCallOverlayProps) => {
  const insets = useSafeAreaInsets();
  const windowHeight = Dimensions.get("window").height;
  const translateY = useSharedValue(windowHeight);
  const [rendered, setRendered] = useState(visible);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (visible) {
      setRendered(true);
      translateY.value = windowHeight;
      translateY.value = withTiming(0, {
        duration: 2200,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    translateY.value = withTiming(windowHeight, {
      duration: 260,
      easing: Easing.in(Easing.cubic),
    });

    hideTimeoutRef.current = setTimeout(() => {
      setRendered(false);
    }, 270);

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };
  }, [translateY, visible, windowHeight]);

  const palette = useMemo(
    () => ({
      background: variant === "incomingCall" ? "#000000" : darkMode ? "#0d0f12" : "#ffffff",
      textPrimary: darkMode ? "#f5f5f5" : "#111111",
      textSecondary: darkMode ? "#b8bec6" : "#666666",
      kicker: "#b03030",
      divider: darkMode ? "#1f2329" : "#eeeeee",
      button: "#1a9f7a",
      danger: "#d94b4b",
      success: "#1a9f7a",
    }),
    [darkMode, variant]
  );

  if (!rendered) {
    return null;
  }

  const bottomPad = Math.max(16, insets.bottom + 12);

  const renderClassic = () => (
    <>
      <View style={styles.content}>
        <TwemojiSkull width={140} height={140} style={styles.skull} />
        <Text style={[styles.kicker, { color: palette.kicker }]}>MARGIN CALL</Text>
        <Text style={[styles.title, { color: palette.textPrimary }]}>You got liquidated.</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Your position hit the maintenance margin.</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <UiButton title="Try again" onPress={onTryAgain} variant="borderedProminent" color={palette.button} controlSize="large" />
      </View>
    </>
  );

  const renderIncomingCall = () => (
    <>
      <View style={styles.callContent}>
        <Text style={styles.callTitle}>Margin</Text>
        <Text style={styles.callSubtitle}>Incoming call...</Text>
      </View>
      <View style={[styles.callFooter, { paddingBottom: bottomPad }]}>
        <View style={styles.callButtons}>
          <View style={styles.callButtonCol}>
            <View style={styles.callButtonWrap}>
              <UiButton
                title=""
                onPress={onTryAgain}
                variant="borderedProminent"
                color={palette.danger}
                controlSize="large"
                style={styles.callCircle}
                darkMode
              />
              <View pointerEvents="none" style={[styles.callPhoneIcon, styles.callPhoneIconDecline]}>
                <TwemojiPhone width={36} height={36} />
              </View>
            </View>
            <Text style={styles.callLabel}>Decline</Text>
          </View>
          <View style={styles.callButtonCol}>
            <View style={styles.callButtonWrap}>
              <UiButton
                title=""
                onPress={onTryAgain}
                variant="borderedProminent"
                color={palette.success}
                controlSize="large"
                style={styles.callCircle}
                darkMode
              />
              <View pointerEvents="none" style={[styles.callPhoneIcon, styles.callPhoneIconAnswer]}>
                <TwemojiPhone width={36} height={36} />
              </View>
            </View>
            <Text style={styles.callLabel}>Answer</Text>
          </View>
        </View>
      </View>
    </>
  );

  const renderBreakingNews = () => (
    <>
      <View style={styles.newsContent}>
        <View style={styles.newsBanner}>
          <TwemojiSiren width={20} height={20} />
          <Text style={styles.newsBannerText}>BREAKING</Text>
          <TwemojiSiren width={20} height={20} />
        </View>
        <Text style={[styles.newsHeadline, { color: palette.textPrimary }]}>MARGIN CALL</Text>
        <Text style={[styles.newsDeck, { color: palette.textSecondary }]}>Local trader discovers leverage.</Text>
      </View>
      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <UiButton title="Try again" onPress={onTryAgain} variant="borderedProminent" color={palette.button} controlSize="large" />
      </View>
    </>
  );

  return (
    <Animated.View pointerEvents={visible ? "auto" : "none"} style={[styles.container, { backgroundColor: palette.background }, animatedStyle]}>
      {variant !== "incomingCall" ? <View style={[styles.topChrome, { borderBottomColor: palette.divider }]} /> : null}
      {variant === "incomingCall" ? renderIncomingCall() : variant === "breakingNews" ? renderBreakingNews() : renderClassic()}
    </Animated.View>
  );
});

MarginCallOverlay.displayName = "MarginCallOverlay";

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 50,
  },
  topChrome: {
    height: 1,
    borderBottomWidth: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  skull: {
    marginBottom: 16,
  },
  kicker: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 20,
  },
  footer: {
    width: "100%",
    paddingHorizontal: 16,
  },

  callContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 64,
  },
  callTitle: {
    fontSize: 44,
    fontWeight: "300",
    color: "#ffffff",
    marginBottom: 10,
  },
  callSubtitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.72)",
  },
  callFooter: {
    width: "100%",
    paddingHorizontal: 40,
    paddingTop: 10,
  },
  callButtons: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  callButtonCol: {
    alignItems: "center",
    justifyContent: "center",
  },
  callButtonWrap: {
    position: "relative",
  },
  callCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  callPhoneIcon: {
    position: "absolute",
    left: 24,
    top: 24,
    opacity: 0.96,
  },
  callPhoneIconAnswer: {
    transform: [{ rotate: "-18deg" }],
  },
  callPhoneIconDecline: {
    left: 22,
    top: 26,
    transform: [{ rotate: "138deg" }],
  },
  callLabel: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.72)",
  },
  newsContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  newsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#d94b4b",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginBottom: 14,
  },
  newsBannerText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: 1,
  },
  newsHeadline: {
    fontSize: 40,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10,
  },
  newsDeck: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 320,
  },
});
