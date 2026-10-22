import "react-native-reanimated";
import { useEffect } from "react";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { Stack, useNavigationContainerRef } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RevenueCatProvider } from "../src/contexts/RevenueCatContext";
import { useGameStore } from "../src/stores/useGameStore";
import Constants from "expo-constants";
import { trackScreen, vexo } from "vexo-analytics";

if (__DEV__) {
  configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false,
  });
}

// Initialize Vexo analytics
const vexoApiKey = Constants.expoConfig?.extra?.vexoApiKey;
if (vexoApiKey) {
  try {
    vexo(vexoApiKey);
    console.log("vexo initialized");
  } catch (error) {
    console.warn("Vexo initialization failed:", error);
  }
} else {
  console.log("Vexo API key missing, skipping initialization");
}

// Prevent auto-hiding splash screen
SplashScreen.preventAutoHideAsync();

export default function Layout() {
  const navRef = useNavigationContainerRef();
  const darkMode = useGameStore((state) => state.darkMode);
  // Whatever peeks out behind screens mid-transition should match the theme, not flash white.
  const rootBackground = darkMode ? "#0d0f12" : "#ffffff";

  // vexo's expo-router auto-attach can't patch SDK 58's NavigationContainer, so report screens via the public ref.
  useEffect(() => {
    if (!vexoApiKey || !navRef) return;
    const report = () => {
      const route = navRef.getCurrentRoute() as { name?: string } | undefined;
      const name = route?.name;
      if (name) trackScreen(name);
    };
    report();
    return navRef.addListener("state", report);
  }, [navRef]);

  return (
    <SafeAreaProvider style={[styles.container, { backgroundColor: rootBackground }]}>
      <RevenueCatProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: rootBackground } }} />
      </RevenueCatProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
