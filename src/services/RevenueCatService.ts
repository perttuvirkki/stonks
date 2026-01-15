/**
 * RevenueCat Service - Simple one-time "PRO" purchase
 */

import Purchases, { type CustomerInfo, type PurchasesOfferings, LOG_LEVEL } from "react-native-purchases";
import { Platform } from "react-native";
import Constants from "expo-constants";

const REVENUECAT_API_KEY = Constants.expoConfig?.extra?.revenueCatApiKey ?? "";
export const ENTITLEMENT_ID = "PRO";

class RevenueCatService {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);

      if (Platform.OS === "ios" || Platform.OS === "android") {
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY });
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
      const pkg = offerings.current?.availablePackages[0];
      return pkg?.product.priceString ?? null;
    } catch (error) {
      console.error("[RevenueCat] Failed to get price:", error);
      return null;
    }
  }

  async purchasePro(): Promise<boolean> {
    try {
      const offerings = await this.getOfferings();
      const pkg = offerings.current?.availablePackages[0];

      if (!pkg) {
        console.error("[RevenueCat] No package available");
        return false;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== "undefined";
    } catch (error: any) {
      if (!error.userCancelled) {
        console.error("[RevenueCat] Purchase failed:", error);
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
    return Purchases.addCustomerInfoUpdateListener(listener);
  }
}

export const revenueCatService = new RevenueCatService();
