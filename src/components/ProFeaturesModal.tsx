import React, { memo, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { UiButton } from "./UiButton";
import { TERMINAL_FONT, getTerminalPalette } from "../theme/terminal";
import TwemojiTrophy from "../../assets/twemoji/1f3c6.svg";
import TwemojiRocket from "../../assets/twemoji/1f680.svg";
import TwemojiHeart from "../../assets/twemoji/2764.svg";
import TwemojiSparkles from "../../assets/twemoji/2728.svg";
import TwemojiMoon from "../../assets/twemoji/1f319.svg";
import TwemojiBanknote from "../../assets/twemoji/1f4b5.svg";

export type ProFeaturesModalProps = {
  visible: boolean;
  darkMode: boolean;
  price: string | null;
  onBuy: () => void;
  onClose: () => void;
  isPurchasing: boolean;
};

export const ProFeaturesModal = memo(({ visible, darkMode, price, onBuy, onClose, isPurchasing }: ProFeaturesModalProps) => {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
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
      translateY.value = withTiming(0, {
        duration: 320,
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

  if (!rendered) {
    return null;
  }

  const bottomPad = Math.max(16, insets.bottom + 12);
  const topPad = Math.max(16, insets.top + 32);

  const palette = getTerminalPalette(darkMode);
  const background = palette.bg;
  const textPrimary = palette.text;
  const textSecondary = palette.textDim;
  const activeColor = palette.amber;
  const featureBg = palette.panel;

  return (
    <Animated.View style={[styles.overlay, animatedStyle, { backgroundColor: background }]}>
      <View style={[styles.content, { paddingTop: topPad }]}>
        <View style={styles.header}>
            <TwemojiTrophy width={64} height={64} style={{ marginBottom: 16 }} />
          <Text style={[styles.title, { color: palette.amber }]}>Go PRO</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>Unlock the full experience.</Text>
        </View>

        <View style={styles.features}>
            <FeatureRow 
                icon={<TwemojiBanknote width={28} height={28} />} 
                title="Start with +$100 bonus" 
                subtitle="It's not gonna make a difference" 
                darkMode={darkMode} 
                bg={featureBg} 
                color={textPrimary}
                subColor={textSecondary}
            />

            <FeatureRow 
                icon={<TwemojiHeart width={28} height={28} />} 
                title="Support Development" 
                subtitle="Help us buy more meme stonks" 
                darkMode={darkMode} 
                bg={featureBg} 
                 color={textPrimary}
                subColor={textSecondary}
            />
            <FeatureRow 
                icon={<TwemojiMoon width={28} height={28} />} 
                title="Pro terminal (dark mode)"
                subtitle="Easy on the eyes" 
                darkMode={darkMode} 
                bg={featureBg} 
                 color={textPrimary}
                subColor={textSecondary}
            />
        </View>

      </View>

      <View style={[styles.footer, { paddingBottom: bottomPad }]}>
        <View style={styles.buttonContainer}>
          <UiButton
            title={isPurchasing ? "Purchasing..." : `Buy PRO for ${price ?? "..."}`}
            onPress={onBuy}
            variant="borderedProminent"
            color={activeColor}
            controlSize="large"
            disabled={isPurchasing}
            style={styles.buyButton}
            darkMode={darkMode}
          />
           <UiButton
            title="Cancel"
            onPress={onClose}
            variant="plain"
            color={textSecondary}
            controlSize="large"
            disabled={isPurchasing}
            darkMode={darkMode}
          />
        </View>
      </View>
    </Animated.View>
  );
});

const FeatureRow = ({ icon, title, subtitle, darkMode, bg, color, subColor }: any) => (
    <View style={[styles.featureRow, { backgroundColor: bg, borderColor: getTerminalPalette(darkMode).border, borderLeftColor: getTerminalPalette(darkMode).amber }]}>
        <View style={styles.iconContainer}>{icon}</View>
        <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color }]}>{title}</Text>
            <Text style={[styles.featureSubtitle, { color: subColor }]}>{subtitle}</Text>
        </View>
    </View>
)

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 60,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    width: "100%",
    maxWidth: 640,
  },
  title: {
    fontFamily: TERMINAL_FONT,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: TERMINAL_FONT,
    fontSize: 14,
    textAlign: "center",
  },
  features: {
    width: "100%",
    maxWidth: 640,
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 2,
    borderWidth: 1,
    borderLeftWidth: 3,
  },
  iconContainer: {
      marginRight: 16,
      width: 40,
      alignItems: 'center',
  },
  featureText: {
      flex: 1,
  },
  featureTitle: {
      fontFamily: TERMINAL_FONT,
      fontSize: 15,
      fontWeight: '700',
      textTransform: 'uppercase',
      marginBottom: 2,
  },
  featureSubtitle: {
      fontFamily: TERMINAL_FONT,
      fontSize: 12,
  },
  footer: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  buttonContainer: {
      gap: 12,
  },
  buyButton: {
      width: '100%',
  }
});
