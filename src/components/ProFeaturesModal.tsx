import React, { memo, useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { UiButton } from "./UiButton";
import TwemojiTrophy from "../../assets/twemoji/1f3c6.svg";
import TwemojiRocket from "../../assets/twemoji/1f680.svg";
import TwemojiHeart from "../../assets/twemoji/2764.svg";
import TwemojiSparkles from "../../assets/twemoji/2728.svg";
import TwemojiMoon from "../../assets/twemoji/1f319.svg";
import TwemojiBanknote from "../../assets/twemoji/1f4b5.svg";
import TwemojiWheel from "../../assets/twemoji/1f6de.svg";

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

  const background = darkMode ? "#0d0f12" : "#ffffff";
  const textPrimary = darkMode ? "#f5f5f5" : "#111111";
  const textSecondary = darkMode ? "#b8bec6" : "#666666";
  const activeColor = "#1a9f7a";
  const featureBg = darkMode ? "#15181d" : "#f8f8f8";

  return (
    <Animated.View style={[styles.overlay, animatedStyle, { backgroundColor: background }]}>
      <View style={[styles.content, { paddingTop: topPad }]}>
        <View style={styles.header}>
            <TwemojiTrophy width={64} height={64} style={{ marginBottom: 16 }} />
          <Text style={[styles.title, { color: textPrimary }]}>Go PRO</Text>
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
                icon={<TwemojiWheel width={28} height={28} />} 
                title="Training Wheels" 
                subtitle="Practice with pattern lines" 
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
          />
           <UiButton
            title="Cancel"
            onPress={onClose}
            variant="plain"
            color={textSecondary}
            controlSize="large"
            disabled={isPurchasing}
          />
        </View>
      </View>
    </Animated.View>
  );
});

const FeatureRow = ({ icon, title, subtitle, darkMode, bg, color, subColor }: any) => (
    <View style={[styles.featureRow, { backgroundColor: bg }]}>
        <View style={styles.iconContainer}>{icon}</View>
        <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color }]}>{title}</Text>
            <Text style={[styles.featureSubtitle, { color: subColor }]}>{subtitle}</Text>
        </View>
    </View>
)

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
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
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
  },
  features: {
    width: "100%",
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
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
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 2,
  },
  featureSubtitle: {
      fontSize: 14,
  },
  footer: {
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
