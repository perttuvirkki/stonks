# Leaderboards and achievements

The app reports to these IDs (see `src/services/GameCenterService.ts`). Leaderboards and
achievements only work once they exist in **App Store Connect → Game Center** (iOS) and
**Play Console → Play Games Services** (Android). An empty Android ID means "not set up yet":
the app skips it and the menu says "Coming soon".

## Leaderboards

| Key | iOS ID | Score | Format | Submission type |
| --- | --- | --- | --- | --- |
| 60s Sprint | `topscores1` (exists) | end-of-round stack, $ | Integer (money) | Best score, high to low |
| All-Time Profit | `netprofit1` (exists) | all-time net profit, $ (can be negative) | Integer (money) | **Most recent score** |
| 5 Trades | `fivetrades1` | end-of-run stack, $ | Integer (money) | Best score, high to low |

Pop Quiz and Training Wheels have achievements only, no leaderboards.

**All-Time Profit must be "Most Recent Score".** With "Best score" Game Center keeps the
highest value ever sent, so the board never goes down after losses or liquidations. That is
the most likely reason it looked bugged; check the setting on `netprofit1`.

Play Games has no "most recent" option (it always keeps the best), so on Android the
All-Time Profit board only ever shows your peak. If Play Games rejects negative scores,
negative net profit simply won't be recorded there.

Android IDs already in code: Sprint `CgkI5OK25LMEEAIQAQ`, All-Time Profit `CgkI5OK25LMEEAIQAw`.
Create the 5 Trades one in Play Console and paste its ID into `LEADERBOARD_IDS`.

## Achievements

All iOS IDs are prefixed `com.ludussuper.stonks.`. Create them in App Store Connect, then
create matching ones in Play Console and paste the Android IDs into `ACHIEVEMENT_IDS`.

| Key | iOS ID suffix | Unlocks when |
| --- | --- | --- |
| First Trade | `firsttrade` | first real-money trade is closed |
| 10x Degen | `leverage10x` | a real-money trade is opened at 10x or more |
| Centurion | `survive100` | 100 rounds played (ID kept from the old, unused definition) |
| Margin Called | `liquidated` | first liquidation |
| Double Up | `sprintdouble` | a 60s Sprint ends at +100% or better |
| Five and Done | `fivetradesdone` | a 5 Trades run is completed |
| Perfect Five | `fivetradesperfect` | all 5 trades in a run are winners |
| Five to Double | `fivetradesdouble` | a 5 Trades run ends at +100% or better |
| Called It | `quizfirst` | first correct Pop Quiz call |
| Hot Streak | `quizstreak5` | 5 correct quiz calls in a row |
| Chart Whisperer | `quizstreak10` | 10 correct quiz calls in a row |
| Green Wheels | `trainingfirstgreen` | first profitable training trade |
| Paper Hands Up | `trainingplus50` | a training session reaches +50% |
| Four Figures | `netprofit1k` | all-time net profit reaches $1,000 |
| Five Figures | `netprofit10k` | all-time net profit reaches $10,000 |

Names are suggestions. The app remembers which achievements unlocked successfully and only
reports new ones; a failed unlock (e.g. not signed in) is retried the next time it's earned.
