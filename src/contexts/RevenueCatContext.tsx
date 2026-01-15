/**
 * RevenueCat Context - Simple PRO purchase hook
 */

import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { type CustomerInfo } from "react-native-purchases";
import { revenueCatService, ENTITLEMENT_ID } from "../services/RevenueCatService";
import { useGameStore } from "../stores/useGameStore";

export type RevenueCatContextType = {
  isInitialized: boolean;
  isLoading: boolean;
  isPro: boolean;
  proPrice: string | null;
  purchasePro: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
};

const RevenueCatContext = createContext<RevenueCatContextType | null>(null);

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPro, setIsPro] = useState(useGameStore.getState().isPro);
  const [proPrice, setProPrice] = useState<string | null>(null);

  const syncPro = useCallback((status: boolean) => {
    setIsPro(status);
    useGameStore.getState().setIsPro(status);
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        await revenueCatService.initialize();
        setIsInitialized(true);
        const [pro, price] = await Promise.all([
          revenueCatService.isPro(),
          revenueCatService.getProPriceString(),
        ]);
        syncPro(pro);
        setProPrice(price);
      } catch (error) {
        console.error("[RevenueCat] Init error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    const removeListener = revenueCatService.addCustomerInfoUpdateListener((info: CustomerInfo) => {
      syncPro(typeof info.entitlements.active[ENTITLEMENT_ID] !== "undefined");
    });

    return removeListener;
  }, []);

  const purchasePro = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await revenueCatService.purchasePro();
      syncPro(success);
      return success;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await revenueCatService.restorePurchases();
      syncPro(success);
      return success;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <RevenueCatContext.Provider value={{ isInitialized, isLoading, isPro, proPrice, purchasePro, restorePurchases }}>{children}</RevenueCatContext.Provider>
  );
}

export function useRevenueCat(): RevenueCatContextType {
  const context = useContext(RevenueCatContext);
  if (!context) {
    throw new Error("useRevenueCat must be used within RevenueCatProvider");
  }
  return context;
}

export function useIsPro(): boolean {
  const { isPro } = useRevenueCat();
  return isPro;
}
