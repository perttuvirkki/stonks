import { Platform } from "react-native";
import * as ExpoStoresGamesServices from "expo-stores-games-services";
import Constants from "expo-constants";

// Types
export interface GameCenterPlayer {
  isAuthenticated: boolean;
  playerID: string | null;
  displayName: string | null;
  alias: string | null;
}

import type { AchievementKey, LeaderboardKey, Progress } from "../progress";

// Leaderboard and achievement IDs.
// - iOS: Game Center identifiers, as created in App Store Connect.
// - Android: Play Games Services IDs (look like "CgkI..."), as created in Play Console.
// An empty ID means "not set up on that platform yet": nothing is submitted for it.
type LeaderboardExtra = {
  leaderboardHighScoreIos?: string;
  leaderboardHighScoreAndroid?: string;
  leaderboardNetProfitIos?: string;
  leaderboardNetProfitAndroid?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as LeaderboardExtra;

type PlatformIds = { ios: string; android: string };

const pick = (ids: PlatformIds) => Platform.select({ ios: ids.ios, android: ids.android }) ?? "";

const LEADERBOARD_IDS: Record<LeaderboardKey, PlatformIds> = {
  sprint: {
    ios: extra.leaderboardHighScoreIos || "topscores1",
    android: extra.leaderboardHighScoreAndroid || "CgkI5OK25LMEEAIQAQ",
  },
  netProfit: {
    ios: extra.leaderboardNetProfitIos || "netprofit1",
    android: extra.leaderboardNetProfitAndroid || "CgkI5OK25LMEEAIQAw",
  },
  fiveTrades: { ios: "fivetrades1", android: "" },
  quizStreak: { ios: "quizstreak1", android: "" },
  trainingReturn: { ios: "trainingreturn1", android: "" },
};

const ACHIEVEMENT_IDS: Record<AchievementKey, PlatformIds> = {
  firstTrade: { ios: "com.ludussuper.stonks.firsttrade", android: "" },
  leverage10x: { ios: "com.ludussuper.stonks.leverage10x", android: "" },
  rounds100: { ios: "com.ludussuper.stonks.survive100", android: "" },
  liquidated: { ios: "com.ludussuper.stonks.liquidated", android: "" },
  sprintDouble: { ios: "com.ludussuper.stonks.sprintdouble", android: "" },
  fiveTradesDone: { ios: "com.ludussuper.stonks.fivetradesdone", android: "" },
  fiveTradesPerfect: { ios: "com.ludussuper.stonks.fivetradesperfect", android: "" },
  fiveTradesDouble: { ios: "com.ludussuper.stonks.fivetradesdouble", android: "" },
  quizFirstCorrect: { ios: "com.ludussuper.stonks.quizfirst", android: "" },
  quizStreak5: { ios: "com.ludussuper.stonks.quizstreak5", android: "" },
  quizStreak10: { ios: "com.ludussuper.stonks.quizstreak10", android: "" },
  trainingFirstGreen: { ios: "com.ludussuper.stonks.trainingfirstgreen", android: "" },
  trainingPlus50: { ios: "com.ludussuper.stonks.trainingplus50", android: "" },
  netProfit1k: { ios: "com.ludussuper.stonks.netprofit1k", android: "" },
  netProfit10k: { ios: "com.ludussuper.stonks.netprofit10k", android: "" },
};

export const leaderboardId = (key: LeaderboardKey) => pick(LEADERBOARD_IDS[key]);
export const achievementId = (key: AchievementKey) => pick(ACHIEVEMENT_IDS[key]);

export const LEADERBOARDS = {
  HIGH_SCORE: leaderboardId("sprint"),
  NET_PROFIT: leaderboardId("netProfit"),
  FIVE_TRADES: leaderboardId("fiveTrades"),
  QUIZ_STREAK: leaderboardId("quizStreak"),
  TRAINING_RETURN: leaderboardId("trainingReturn"),
} as const;

/**
 * Submit the scores and unlock the achievements a game event earned. Achievements in
 * `alreadyUnlocked` are skipped so the same one isn't re-reported on every round.
 * Resolves to the achievement keys that unlocked successfully, so the caller can remember
 * them; failed ones (e.g. not signed in) are tried again the next time they're earned.
 */
export async function reportProgress(progress: Progress, alreadyUnlocked: readonly string[]): Promise<AchievementKey[]> {
  for (const { board, score } of progress.scores) {
    void submitScore(leaderboardId(board), score);
  }
  const fresh = progress.achievements.filter(
    (key, index, all) => all.indexOf(key) === index && !alreadyUnlocked.includes(key) && achievementId(key) !== "",
  );
  const results = await Promise.all(fresh.map((key) => unlockAchievement(achievementId(key))));
  return fresh.filter((_, index) => results[index]);
}

/**
 * Check if Game Center is available on this platform
 */
export function isGameCenterAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

/**
 * Authenticate the local player with Game Center
 * This will show the Game Center login UI if the player is not already signed in
 */
export async function authenticate(): Promise<GameCenterPlayer> {
  console.log("GameCenterService: Checking availability...");
  if (!isGameCenterAvailable()) {
    console.log("GameCenterService: Game Center not available on this platform/device");
    return {
      isAuthenticated: false,
      playerID: null,
      displayName: null,
      alias: null,
    };
  }
  
  try {
    console.log("GameCenterService: Calling signIn()");
    const result = await ExpoStoresGamesServices.signIn();
    console.log("GameCenterService: signIn returned:", result);
    return {
      isAuthenticated: true,
      playerID: result.playerID,
      displayName: result.displayName,
      alias: result.alias,
    };
  } catch (error) {
    console.warn("Game Center authentication failed:", error);
    return {
      isAuthenticated: false,
      playerID: null,
      displayName: null,
      alias: null,
    };
  }
}

/**
 * Check if the player is currently authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  if (!isGameCenterAvailable()) {
    return false;
  }
  
  try {
    return await ExpoStoresGamesServices.isAuthenticated();
  } catch {
    return false;
  }
}

/**
 * Get the current player's information
 */
export async function getPlayer(): Promise<GameCenterPlayer> {
  if (!isGameCenterAvailable()) {
    return {
      isAuthenticated: false,
      playerID: null,
      displayName: null,
      alias: null,
    };
  }
  
  try {
    const isAuth = await ExpoStoresGamesServices.isAuthenticated();
    if (isAuth) {
      const result = await ExpoStoresGamesServices.signIn();
      return {
        isAuthenticated: true,
        playerID: result.playerID,
        displayName: result.displayName,
        alias: result.alias,
      };
    }
    return {
      isAuthenticated: false,
      playerID: null,
      displayName: null,
      alias: null,
    };
  } catch {
    return {
      isAuthenticated: false,
      playerID: null,
      displayName: null,
      alias: null,
    };
  }
}

/**
 * Submit a score to a leaderboard
 */
export async function submitScore(leaderboardID: string, score: number): Promise<boolean> {
  if (!isGameCenterAvailable()) {
    return false;
  }
  if (!leaderboardID) {
    return false;
  }
  
  try {
    // Android commonly fails with ConnectionResult=4 (SIGN_IN_REQUIRED) unless signed in first.
    if (Platform.OS === "android" && !(await isAuthenticated())) {
      await authenticate();
    }
    await ExpoStoresGamesServices.submitScore(Math.floor(score), leaderboardID);
    return true;
  } catch (error) {
    console.warn("Failed to submit score:", error);
    return false;
  }
}

/**
 * Show a specific leaderboard
 * @param leaderboardID The leaderboard identifier
 * @param timeSpan 0 = today, 1 = week, 2 = all time (default)
 */
export async function showLeaderboard(leaderboardID: string, timeSpan: number = 2): Promise<void> {
  if (!isGameCenterAvailable()) {
    return;
  }
  if (!leaderboardID) {
    return;
  }
  
  try {
    // Android commonly fails with ConnectionResult=4 (SIGN_IN_REQUIRED) unless signed in first.
    if (Platform.OS === "android" && !(await isAuthenticated())) {
      await authenticate();
    }
    await ExpoStoresGamesServices.showLeaderboard(leaderboardID, timeSpan);
  } catch (error) {
    console.warn("Failed to show leaderboard:", error);
  }
}

/**
 * Show all leaderboards
 */
export async function showAllLeaderboards(): Promise<void> {
  if (!isGameCenterAvailable()) {
    return;
  }
  
  try {
    // Use the achievements view as a fallback since showLeaderboard requires ID
    await ExpoStoresGamesServices.showLeaderboard(LEADERBOARDS.HIGH_SCORE, 2);
  } catch (error) {
    console.warn("Failed to show leaderboards:", error);
  }
}

/**
 * Unlock an achievement (or report progress)
 * @param achievementID The achievement identifier
 * @param percentComplete Progress from 0 to 100 (100 = fully unlocked)
 */
export async function unlockAchievement(achievementID: string, percentComplete: number = 100): Promise<boolean> {
  if (!isGameCenterAvailable() || !achievementID) {
    return false;
  }
  
  try {
    if (percentComplete >= 100) {
      await ExpoStoresGamesServices.unlockAchievement(achievementID);
    } else {
      // Use increment for partial progress - assuming 100 total steps
      await ExpoStoresGamesServices.incrementAchievement(achievementID, Math.floor(percentComplete), 100);
    }
    return true;
  } catch (error) {
    console.warn("Failed to unlock achievement:", error);
    return false;
  }
}

/**
 * Show the achievements view
 */
export async function showAchievements(): Promise<void> {
  if (!isGameCenterAvailable()) {
    return;
  }
  
  try {
    await ExpoStoresGamesServices.showAchievements();
  } catch (error) {
    console.warn("Failed to show achievements:", error);
  }
}
