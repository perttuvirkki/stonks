# stonks

Mobile trading game built with Expo + React Native.

`stonks` is a chart-based game where you trade synthetic price action using leverage, try to survive margin calls, and compare results in local and global leaderboards.

The game focuses on short, high-volatility rounds with multiple modes, synthetic market patterns, local stat tracking, and optional global leaderboards and Pro features.

## Tech Stack

- Expo SDK 58
- React Native 0.88 + React 19.3
- TypeScript
- `expo-router`
- `lightweight-charts` (inside a `react-native-webview`; bundled into `src/chartScript.ts` via `npm run generate:chart`)
- Zustand for local state persistence
