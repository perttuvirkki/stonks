import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import TwemojiSkull from "../../assets/twemoji/1f480.svg";
import TwemojiPhone from "../../assets/twemoji/1f4de.svg";
import TwemojiSiren from "../../assets/twemoji/1f6a8.svg";
import TwemojiBurger from "../../assets/twemoji/1f354.svg";
import TwemojiBook from "../../assets/twemoji/1f4d6.svg";
import TwemojiTears from "../../assets/twemoji/1f972.svg";
import TwemojiMirror from "../../assets/twemoji/1fa9e.svg";
import TwemojiBusts from "../../assets/twemoji/1f465.svg";
import { UiButton } from "./UiButton";

export type MarginCallVariant = "classic" | "incomingCall" | "breakingNews" | "instruction" | "mirror";

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
      <View style={[styles.mcdonaldsContainer, { backgroundColor: "#DA291C" }]}>
        {/* Golden arches header */}
        <View style={styles.mcdonaldsHeader}>
          <TwemojiBurger width={64} height={64} style={{ marginBottom: 8 }} />
          <Text style={styles.mcdonaldsLogo}>McD's</Text>
        </View>
        
        {/* Application form */}
        <View style={styles.mcdonaldsForm}>
          <Text style={styles.mcdonaldsFormTitle}>JOB APPLICATION</Text>
          
          <View style={styles.mcdonaldsField}>
            <Text style={styles.mcdonaldsLabel}>Position Applied For:</Text>
            <View style={styles.mcdonaldsInput}>
              <Text style={styles.mcdonaldsInputText}>Burger Flipper</Text>
            </View>
          </View>
          
          <View style={styles.mcdonaldsField}>
            <Text style={styles.mcdonaldsLabel}>Reason for Applying:</Text>
            <View style={[styles.mcdonaldsInput, styles.mcdonaldsInputLarge]}>
              <Text style={styles.mcdonaldsInputText}>Lost all my money trading stonks with leverage. Need money for rent.</Text>
            </View>
          </View>
          
          <View style={styles.mcdonaldsField}>
            <Text style={styles.mcdonaldsLabel}>Previous Experience:</Text>
            <View style={styles.mcdonaldsInput}>
              <Text style={styles.mcdonaldsInputText}>Day trader (briefly)</Text>
            </View>
          </View>
          
          <View style={styles.mcdonaldsField}>
            <Text style={styles.mcdonaldsLabel}>Available to Start:</Text>
            <View style={styles.mcdonaldsInput}>
              <Text style={styles.mcdonaldsInputText}>Immediately (got margin called)</Text>
            </View>
          </View>
        </View>
        
        <Text style={styles.mcdonaldsTagline}>i'm lovin' it™</Text>
      </View>
      <View style={[styles.mcdonaldsFooter, { paddingBottom: bottomPad }]}>
        <UiButton title="Submit Application" onPress={onTryAgain} variant="borderedProminent" color="#FFC72C" controlSize="large" darkMode />
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

  const renderBreakingNews = () => {
    const today = new Date();
    const dateStr = today.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return (
      <>
        <View style={[styles.newspaperContainer, { backgroundColor: "#f5f0e1" }]}>
          {/* Decorative top rule */}
          <View style={styles.newspaperTopRule} />
          <View style={styles.newspaperTopRuleThin} />
          
          {/* Masthead */}
          <Text style={styles.newspaperMasthead}>THE DAILY STONK</Text>
          
          {/* Date line */}
          <View style={styles.newspaperDateLine}>
            <View style={styles.newspaperDateDivider} />
            <Text style={styles.newspaperDate}>{dateStr.toUpperCase()}</Text>
            <View style={styles.newspaperDateDivider} />
          </View>
          
          {/* Main headline */}
          <View style={styles.newspaperHeadlineWrap}>
            <Text style={styles.newspaperHeadline}>MARGIN CALL</Text>
            <View style={styles.newspaperHeadlineRule} />
          </View>
          
          {/* Subheadline / Deck */}
          <Text style={styles.newspaperDeck}>Local Trader Discovers Leverage;</Text>
          <Text style={styles.newspaperDeck}>Portfolio Wiped Out in Mere Seconds</Text>
          
          {/* Byline */}
          <Text style={styles.newspaperByline}>By Our Financial Correspondent</Text>
          
          {/* Article excerpt */}
          <View style={styles.newspaperArticle}>
            <Text style={styles.newspaperBody}>
              <Text style={styles.newspaperDropCap}>A</Text>
              {" local amateur trader suffered catastrophic losses yesterday after their leveraged position hit the maintenance margin, triggering an automatic liquidation. Witnesses report hearing the sound of a portfolio evaporating."}
            </Text>
          </View>
        </View>
        <View style={[styles.newspaperFooter, { paddingBottom: bottomPad }]}>
          <UiButton title="Try again" onPress={onTryAgain} variant="borderedProminent" color="#2d2d2d" controlSize="large" />
        </View>
      </>
    );
  };

  const renderInstruction = () => (
    <>
      <View style={[styles.instructionContainer, { backgroundColor: "#1a1a2e" }]}>
        {/* Book cover */}
        <View style={styles.bookCover}>
          <View style={styles.bookSpine} />
          <View style={styles.bookFront}>
            <Text style={styles.bookTitle}>HOW TO</Text>
            <Text style={styles.bookTitle}>MAKE MONEY</Text>
            <Text style={styles.bookTitle}>WITH TRADING</Text>
            <TwemojiBook width={80} height={80} style={{ marginTop: 20 }} />
            <Text style={styles.bookAuthor}>by Professional Traders</Text>
          </View>
        </View>
        
        {/* Open page */}
        <View style={styles.openPage}>
          <Text style={styles.pageStep}>Step 1:</Text>
          <Text style={styles.pageContent}>Avoid Leverage</Text>
          <Text style={styles.pageSubtext}>(That's it. That's the whole book.)</Text>
        </View>
      </View>
      <View style={[styles.instructionFooter, { paddingBottom: bottomPad }]}>
        <UiButton title="I should've read this first" onPress={onTryAgain} variant="borderedProminent" color="#4a4a8a" controlSize="large" darkMode />
      </View>
    </>
  );

  const renderMirror = () => (
    <>
      <View style={[styles.mirrorContainer, { backgroundColor: "#1a1a2e" }]}>
        {/* Mirror with busts - back figure in mirror */}
        <View style={styles.mirrorWrapper}>
          <TwemojiMirror width={280} height={280} style={{ position: "absolute"}} />
          <TwemojiBusts width={140} height={140} style={{ position: "absolute", bottom: 0 }} />
        </View>
        
        {/* Affirmation text */}
        <Text style={styles.mirrorText}>"You are not a bad trader"</Text>
        <Text style={styles.mirrorSubtext}>"The market was just manipulated"</Text>
        <Text style={styles.mirrorAttribution}>— Your reflection</Text>
      </View>
      <View style={[styles.mirrorFooter, { paddingBottom: bottomPad }]}>
        <UiButton title="*wipes single tear*" onPress={onTryAgain} variant="borderedProminent" color="#5a5a8a" controlSize="large" darkMode />
      </View>
    </>
  );

  return (
    <Animated.View pointerEvents={visible ? "auto" : "none"} style={[styles.container, { backgroundColor: palette.background }, animatedStyle]}>
      {variant === "incomingCall" ? renderIncomingCall() : variant === "breakingNews" ? renderBreakingNews() : variant === "instruction" ? renderInstruction() : variant === "mirror" ? renderMirror() : renderClassic()}
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
  // Newspaper styles
  newspaperContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  newspaperTopRule: {
    height: 4,
    backgroundColor: "#1a1a1a",
    marginBottom: 2,
  },
  newspaperTopRuleThin: {
    height: 1,
    backgroundColor: "#1a1a1a",
    marginBottom: 20,
  },
  newspaperMasthead: {
    fontSize: 42,
    fontWeight: "900",
    fontFamily: "Georgia",
    textAlign: "center",
    color: "#1a1a1a",
    letterSpacing: 2,
    marginBottom: 8,
  },
  newspaperDateLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    gap: 12,
  },
  newspaperDateDivider: {
    flex: 1,
    height: 1,
    backgroundColor: "#1a1a1a",
  },
  newspaperDate: {
    fontSize: 10,
    fontWeight: "600",
    color: "#444444",
    letterSpacing: 1,
  },
  newspaperHeadlineWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  newspaperHeadline: {
    fontSize: 56,
    fontWeight: "900",
    fontFamily: "Georgia",
    textAlign: "center",
    color: "#1a1a1a",
    letterSpacing: 1,
  },
  newspaperHeadlineRule: {
    width: 80,
    height: 3,
    backgroundColor: "#1a1a1a",
    marginTop: 12,
  },
  newspaperDeck: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "Georgia",
    fontStyle: "italic",
    textAlign: "center",
    color: "#333333",
    lineHeight: 26,
  },
  newspaperByline: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    color: "#666666",
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 16,
    textTransform: "uppercase",
  },
  newspaperArticle: {
    paddingHorizontal: 8,
  },
  newspaperBody: {
    fontSize: 15,
    fontFamily: "Georgia",
    color: "#2d2d2d",
    lineHeight: 24,
    textAlign: "justify",
  },
  newspaperDropCap: {
    fontSize: 48,
    fontWeight: "700",
    fontFamily: "Georgia",
    lineHeight: 40,
  },
  newspaperFooter: {
    width: "100%",
    paddingHorizontal: 16,
    backgroundColor: "#f5f0e1",
  },
  // McDonald's styles
  mcdonaldsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  mcdonaldsHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  mcdonaldsArches: {
    fontSize: 64,
    marginBottom: 8,
  },
  mcdonaldsLogo: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFC72C",
    fontStyle: "italic",
  },
  mcdonaldsForm: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  mcdonaldsFormTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#DA291C",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 1,
  },
  mcdonaldsField: {
    marginBottom: 14,
  },
  mcdonaldsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666666",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mcdonaldsInput: {
    backgroundColor: "#f5f5f5",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  mcdonaldsInputLarge: {
    minHeight: 60,
  },
  mcdonaldsInputText: {
    fontSize: 14,
    color: "#333333",
    lineHeight: 20,
  },
  mcdonaldsTagline: {
    fontSize: 16,
    fontStyle: "italic",
    color: "#FFC72C",
    textAlign: "center",
    marginTop: 20,
    fontWeight: "600",
  },
  mcdonaldsFooter: {
    width: "100%",
    paddingHorizontal: 16,
    backgroundColor: "#DA291C",
  },
  // Instruction book styles
  instructionContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  bookCover: {
    flexDirection: "row",
    marginBottom: 30,
  },
  bookSpine: {
    width: 12,
    backgroundColor: "#8B4513",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  bookFront: {
    backgroundColor: "#2d5a3d",
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    alignItems: "center",
    minWidth: 200,
    borderWidth: 2,
    borderColor: "#1a3d28",
    borderLeftWidth: 0,
  },
  bookTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#ffd700",
    textAlign: "center",
    letterSpacing: 1,
  },
  bookAuthor: {
    fontSize: 11,
    fontWeight: "600",
    color: "#a8d5ba",
    marginTop: 16,
    fontStyle: "italic",
  },
  openPage: {
    backgroundColor: "#f5f1e6",
    paddingVertical: 30,
    paddingHorizontal: 40,
    borderRadius: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pageStep: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666666",
    marginBottom: 8,
  },
  pageContent: {
    fontSize: 28,
    fontWeight: "900",
    color: "#d94b4b",
    textAlign: "center",
  },
  pageSubtext: {
    fontSize: 12,
    fontWeight: "500",
    color: "#888888",
    marginTop: 12,
    fontStyle: "italic",
  },
  instructionFooter: {
    width: "100%",
    paddingHorizontal: 16,
    backgroundColor: "#1a1a2e",
  },
  // Mirror styles
  mirrorContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  mirrorWrapper: {
    width: 280,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },

  mirrorText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f5f5f5",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 8,
  },
  mirrorSubtext: {
    fontSize: 16,
    fontWeight: "500",
    color: "#a0a0a0",
    textAlign: "center",
    fontStyle: "italic",
  },
  mirrorAttribution: {
    fontSize: 13,
    fontWeight: "400",
    color: "#666666",
    textAlign: "center",
    marginTop: 16,
  },
  mirrorFooter: {
    width: "100%",
    paddingHorizontal: 16,
    backgroundColor: "#1a1a2e",
  },
});
