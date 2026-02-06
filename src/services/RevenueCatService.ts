/**
 * RevenueCat Service - Simple one-time "PRO" purchase
 */

import Purchases, { type CustomerInfo, type PurchasesOfferings, type PurchasesPackage, LOG_LEVEL } from "react-native-purchases";
import { Platform } from "react-native";
import Constants from "expo-constants";

type RevenueCatExtra = {
  revenueCatApiKey?: string;
  revenueCatApiKeyIos?: string;
  revenueCatApiKeyAndroid?: string;
};

function getRevenueCatApiKey(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as RevenueCatExtra;

  const byPlatform = Platform.select({
    ios: extra.revenueCatApiKeyIos,
    android: extra.revenueCatApiKeyAndroid,
    default: undefined,
  });

  return (byPlatform ?? extra.revenueCatApiKey ?? "").trim();
}

export const ENTITLEMENT_ID = "PRO";
const PRO_PRODUCT_ID = "pro";

function redactKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 8) return `${trimmed.slice(0, 2)}…`;
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-2)}`;
}

function logLikelyKeyMismatch(apiKey: string) {
  const key = apiKey.trim();
  if (!key) return;
  if (Platform.OS === "android" && !key.startsWith("goog_")) {
    console.warn(`[RevenueCat] Android apiKey doesn't look like a Google key (expected prefix 'goog_'): ${redactKey(key)}`);
  }
  if (Platform.OS === "ios" && !key.startsWith("appl_")) {
    console.warn(`[RevenueCat] iOS apiKey doesn't look like an Apple key (expected prefix 'appl_'): ${redactKey(key)}`);
  }
}

function logPurchasesError(prefix: string, error: unknown) {
  const e = error as any;
  const message = typeof e?.message === "string" ? e.message : String(e);
  const code = e?.code ?? e?.errorCode;
  const underlying = e?.userInfo?.underlyingErrorMessage ?? e?.underlyingErrorMessage ?? e?.userInfo?.underlyingError;
  const extra = e?.userInfo ?? e?.extras;

  console.error(prefix, {
    message,
    code,
    underlying,
    userInfo: extra,
  });
}

function pickProPackage(offerings: PurchasesOfferings): PurchasesPackage | null {
  const packages = offerings.current?.availablePackages ?? [];
  if (!packages.length) {
    return null;
  }

  const directMatch = packages.find((pkg) => pkg?.product?.identifier === PRO_PRODUCT_ID);
  return directMatch ?? packages[0] ?? null;
}

class RevenueCatService {
  private initialized = false;
  private customerInfoListener: ((info: CustomerInfo) => void) | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      if (Platform.OS === "ios" || Platform.OS === "android") {
        const apiKey = getRevenueCatApiKey();
        if (!apiKey) {
          throw new Error(
            "[RevenueCat] Missing public SDK key. Set REVENUECAT_IOS_API_KEY / REVENUECAT_ANDROID_API_KEY (or REVENUECAT_API_KEY fallback).",
          );
        }
        logLikelyKeyMismatch(apiKey);
        await Purchases.configure({ apiKey });
      }

      this.initialized = true;
      console.log("[RevenueCat] Initialized");
    } catch (error) {
      console.error("[RevenueCat] Init failed:", error);
      throw error;
    }
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    return Purchases.getCustomerInfo();
  }

  async isPro(): Promise<boolean> {
    try {
      const info = await this.getCustomerInfo();
      return typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
    } catch {
      return false;
    }
  }

  async getOfferings(): Promise<PurchasesOfferings> {
    return Purchases.getOfferings();
  }

  async getProPriceString(): Promise<string | null> {
    try {
      const offerings = await this.getOfferings();
      const pkg = pickProPackage(offerings);
      return pkg?.product.priceString ?? null;
    } catch (error) {
      logPurchasesError("[RevenueCat] Failed to get price", error);
      return null;
    }
  }

  async purchasePro(): Promise<boolean> {
    try {
      const offerings = await this.getOfferings();
      const pkg = pickProPackage(offerings);

      if (!pkg) {
        console.error("[RevenueCat] No package available");
        return false;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";
    } catch (error: any) {
      if (!error.userCancelled) {
        logPurchasesError("[RevenueCat] Purchase failed", error);
      }
      return false;
    }
  }

  async restorePurchases(): Promise<boolean> {
    try {
      const info = await Purchases.restorePurchases();
      return typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined";
    } catch {
      return false;
    }
  }

  addCustomerInfoUpdateListener(listener: (info: CustomerInfo) => void): () => void {
    this.customerInfoListener = listener;
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      if (!this.customerInfoListener) return;
      Purchases.removeCustomerInfoUpdateListener(this.customerInfoListener);
      this.customerInfoListener = null;
    };
  }
}

export const revenueCatService = new RevenueCatService();
