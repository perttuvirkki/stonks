import "dotenv/config";
import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "stonks",
  slug: "stonks",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/appicon-ios.icon/Assets/AppIcon~ios-marketing.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-custom.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.ludussuper.stonks",
    icon: "./assets/appicon-ios.icon/Assets/AppIcon~ios-marketing.png",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    edgeToEdgeEnabled: true,
    package: "com.ludussuper.stonks",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  extra: {
    vexoApiKey: process.env.VEXO_API_KEY,
    revenueCatApiKey: process.env.REVENUECAT_API_KEY,
  },
});
