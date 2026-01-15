import { Platform } from "react-native";
import * as ExpoStoresGamesServices from "expo-stores-games-services";

// Types
export interface GameCenterPlayer {
  isAuthenticated: boolean;
  playerID: string | null;
  displayName: string | null;
  alias: string | null;
}

// Leaderboard IDs - update these to match your App Store Connect configuration
export const LEADERBOARDS = {
  HIGH_SCORE: "topscores1",
  LONGEST_STREAK: "com.ludussuper.stonks.longeststreak",
  BEST_TRADE: "com.ludussuper.stonks.besttrade",
} as const;

// Achievement IDs - update these to match your App Store Connect configuration
export const ACHIEVEMENTS = {
  FIRST_TRADE: "com.ludussuper.stonks.firsttrade",
  LEVERAGE_10X: "com.ludussuper.stonks.leverage10x",
  SURVIVE_100: "com.ludussuper.stonks.survive100",
} as const;

/**
 * Check if Game Center is available on this platform
 */
export function isGameCenterAvailable(): boolean {
  return Platform.OS === "ios";
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
  
  try {
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
  
  try {
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
  if (!isGameCenterAvailable()) {
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
