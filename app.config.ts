import { ExpoConfig, ConfigContext } from "expo/config";

const APP_ICON = "./assets/appicon-ios.icon/Assets/AppIcon~ios-marketing.png";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "stonks",
  slug: "stonks",
  version: "1.15.0",
  scheme: "stonks",
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-custom.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        // Matches what the legacy top-level `splash` field produced before SDK 55.
        imageWidth: 200,
        enableFullScreenImage_legacy: true,
      },
    ],
    [
      "expo-stores-games-services",
      {
        android: {
          // Play Games Services "Game ID" / APP_ID (numeric string).
          // This becomes `com.google.android.gms.games.APP_ID` in AndroidManifest via the config plugin.
          projectId: process.env.PLAY_GAMES_APP_ID,
        },
      },
    ],
  ],
  orientation: "portrait",
  icon: APP_ICON,
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.ludussuper.stonks",
    icon: APP_ICON,
  },
  android: {
    icon: APP_ICON,
    adaptiveIcon: {
      foregroundImage: APP_ICON,
      backgroundColor: "#ffffff",
    },
    package: "com.ludussuper.stonks",
    versionCode: 5,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    vexoApiKey: process.env.VEXO_API_KEY,
    // RevenueCat has separate public SDK keys per platform.
    revenueCatApiKeyIos: process.env.REVENUECAT_IOS_API_KEY,
    revenueCatApiKeyAndroid: process.env.REVENUECAT_ANDROID_API_KEY,
    // Back-compat fallback (if you used a single env var before).
    revenueCatApiKey: process.env.REVENUECAT_API_KEY,

    // Play Games / Game Center leaderboard IDs (optional overrides / additional boards).
    leaderboardNetProfitIos: process.env.LEADERBOARD_NET_PROFIT_IOS,
    leaderboardNetProfitAndroid: process.env.LEADERBOARD_NET_PROFIT_ANDROID,
  },
});
