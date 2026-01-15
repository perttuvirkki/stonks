import "react-native-reanimated";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RevenueCatProvider } from "../src/contexts/RevenueCatContext";
import Constants from "expo-constants";
import { vexo } from "vexo-analytics";

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
  return (
    <SafeAreaProvider style={styles.container}>
      <RevenueCatProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="auto" />
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
