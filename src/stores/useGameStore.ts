import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HighScore = {
  id: string;
  score: number;
  date: string;
};

export type LeverageStats = {
  tradesCount: number;
  liquidations: number;
};

export type LifetimeStats = {
  totalRounds: number;
  totalTrades: number;
  tradesWon: number;
  tradesLost: number;
  totalProfit: number;
  totalLoss: number;
  biggestWinAmount: number;
  biggestWinPercent: number;
  biggestLossAmount: number;
  biggestLossPercent: number;
  liquidations: number;
  closestToLiquidation: number;
  longestWinStreak: number;
  currentWinStreak: number;
  totalPlayTimeMs: number;
  bestRoundProfit: number;
  worstRoundLoss: number;
  leverageStats: Record<number, LeverageStats>; // keyed by leverage value (5, 10, 25, 50)
};

const DEFAULT_LEVERAGE_STATS: Record<number, LeverageStats> = {
  5: { tradesCount: 0, liquidations: 0 },
  10: { tradesCount: 0, liquidations: 0 },
  25: { tradesCount: 0, liquidations: 0 },
  50: { tradesCount: 0, liquidations: 0 },
};

const DEFAULT_LIFETIME_STATS: LifetimeStats = {
  totalRounds: 0,
  totalTrades: 0,
  tradesWon: 0,
  tradesLost: 0,
  totalProfit: 0,
  totalLoss: 0,
  biggestWinAmount: 0,
  biggestWinPercent: 0,
  biggestLossAmount: 0,
  biggestLossPercent: 0,
  liquidations: 0,
  closestToLiquidation: 100,
  longestWinStreak: 0,
  currentWinStreak: 0,
  totalPlayTimeMs: 0,
  bestRoundProfit: 0,
  worstRoundLoss: 0,
  leverageStats: { ...DEFAULT_LEVERAGE_STATS },
};

type GameState = {
  highScores: HighScore[];
  isPro: boolean;
  darkMode: boolean;
  reviewPromptShown: boolean;
  lifetimeStats: LifetimeStats;
  quoteStackBonusTotal: number;
  quotePendingProBonus: number;
  dailyQuoteLastClaimDayKey: string | null;
  addScore: (score: number) => void;
  clearScores: () => void;
  setIsPro: (status: boolean) => void;
  setReviewPromptShown: (status: boolean) => void;
  claimDailyQuoteBonus: (dayKey: string, amount: number, pendingProBonusAmount?: number) => boolean;
  releasePendingProQuoteBonus: () => number;
  recordRoundEnd: (stats: {
    tradesWon: number;
    tradesLost: number;
    profitAmount: number;
    biggestWinPercent: number;
    biggestLossPercent: number;
    wasLiquidated: boolean;
    closestToLiquidation: number;
    durationMs: number;
    liquidationLeverage?: number;
  }) => void;
  recordTrade: (won: boolean, profitAmount: number, profitPercent: number) => void;
  recordLeverageUse: (leverage: number) => void;
  resetLifetimeStats: () => void;
  setDarkMode: (status: boolean) => void;
};

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      highScores: [],
      isPro: false,
      darkMode: false,
      reviewPromptShown: false,
      lifetimeStats: DEFAULT_LIFETIME_STATS,
      quoteStackBonusTotal: 0,
      quotePendingProBonus: 0,
      dailyQuoteLastClaimDayKey: null,
      addScore: (score) =>
        set((state) => {
          const newScore: HighScore = {
            id: Math.random().toString(36).substr(2, 9),
            score,
            date: new Date().toISOString(),
          };
          
          const updatedScores = [...state.highScores, newScore]
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

          return { highScores: updatedScores };
        }),
      clearScores: () => set({ highScores: [] }),
      setIsPro: (status) => set({ isPro: status }),
      setDarkMode: (status) => set({ darkMode: status }),
      setReviewPromptShown: (status) => set({ reviewPromptShown: status }),
      claimDailyQuoteBonus: (dayKey, amount, pendingProBonusAmount = 0) => {
        if (!dayKey || amount <= 0) {
          return false;
        }
        let didClaim = false;
        set((state) => {
          if (state.dailyQuoteLastClaimDayKey === dayKey) {
            return {};
          }
          didClaim = true;
          return {
            dailyQuoteLastClaimDayKey: dayKey,
            quoteStackBonusTotal: Math.max(0, state.quoteStackBonusTotal + amount),
            quotePendingProBonus: Math.max(0, state.quotePendingProBonus + Math.max(0, pendingProBonusAmount)),
          };
        });
        return didClaim;
      },
      releasePendingProQuoteBonus: () => {
        let releasedAmount = 0;
        set((state) => {
          releasedAmount = Math.max(0, state.quotePendingProBonus);
          if (releasedAmount <= 0) {
            return {};
          }
          return {
            quotePendingProBonus: 0,
            quoteStackBonusTotal: Math.max(0, state.quoteStackBonusTotal + releasedAmount),
          };
        });
        return releasedAmount;
      },
      recordRoundEnd: (stats) =>
        set((state) => {
          const ls = state.lifetimeStats;
          // Ensure leverageStats exists (for legacy stored data)
          const leverageStats = ls.leverageStats 
            ? { ...ls.leverageStats } 
            : { ...DEFAULT_LEVERAGE_STATS };
          
          // If liquidated with a specific leverage, record it
          if (stats.wasLiquidated && stats.liquidationLeverage) {
            const lev = stats.liquidationLeverage;
            if (!leverageStats[lev]) {
              leverageStats[lev] = { tradesCount: 0, liquidations: 0 };
            }
            leverageStats[lev] = {
              ...leverageStats[lev],
              liquidations: leverageStats[lev].liquidations + 1,
            };
          }
          
          const newStats: LifetimeStats = {
            ...ls,
            totalRounds: ls.totalRounds + 1,
            totalTrades: ls.totalTrades + stats.tradesWon + stats.tradesLost,
            tradesWon: ls.tradesWon + stats.tradesWon,
            tradesLost: ls.tradesLost + stats.tradesLost,
            liquidations: stats.wasLiquidated ? ls.liquidations + 1 : ls.liquidations,
            closestToLiquidation: Math.min(ls.closestToLiquidation, stats.closestToLiquidation),
            totalPlayTimeMs: ls.totalPlayTimeMs + stats.durationMs,
            biggestWinPercent: Math.max(ls.biggestWinPercent, stats.biggestWinPercent),
            biggestLossPercent: Math.max(ls.biggestLossPercent, Math.abs(stats.biggestLossPercent)),
            leverageStats,
          };
          
          if (stats.profitAmount > 0) {
            newStats.totalProfit = ls.totalProfit + stats.profitAmount;
            newStats.bestRoundProfit = Math.max(ls.bestRoundProfit, stats.profitAmount);
          } else {
            newStats.totalLoss = ls.totalLoss + Math.abs(stats.profitAmount);
            newStats.worstRoundLoss = Math.max(ls.worstRoundLoss, Math.abs(stats.profitAmount));
          }
          
          return { lifetimeStats: newStats };
        }),
      recordTrade: (won, profitAmount, profitPercent) =>
        set((state) => {
          const ls = state.lifetimeStats;
          const newStreak = won ? ls.currentWinStreak + 1 : 0;
          return {
            lifetimeStats: {
              ...ls,
              currentWinStreak: newStreak,
              longestWinStreak: Math.max(ls.longestWinStreak, newStreak),
              biggestWinAmount: won ? Math.max(ls.biggestWinAmount, profitAmount) : ls.biggestWinAmount,
              biggestLossAmount: !won ? Math.max(ls.biggestLossAmount, Math.abs(profitAmount)) : ls.biggestLossAmount,
            },
          };
        }),
      recordLeverageUse: (leverage) =>
        set((state) => {
          const ls = state.lifetimeStats;
          // Ensure leverageStats exists (for legacy stored data)
          const leverageStats = ls.leverageStats 
            ? { ...ls.leverageStats } 
            : { ...DEFAULT_LEVERAGE_STATS };
          
          // Initialize this leverage level if it doesn't exist
          if (!leverageStats[leverage]) {
            leverageStats[leverage] = { tradesCount: 0, liquidations: 0 };
          }
          
          leverageStats[leverage] = {
            ...leverageStats[leverage],
            tradesCount: leverageStats[leverage].tradesCount + 1,
          };
          
          return {
            lifetimeStats: {
              ...ls,
              leverageStats,
            },
          };
        }),
      resetLifetimeStats: () => set({ lifetimeStats: DEFAULT_LIFETIME_STATS }),
    }),
    {
      name: 'stonks-game-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
