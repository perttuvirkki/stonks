"""Play Games Services setup for stonks via the Games Configuration API.

Usage:  python fastlane/play_games.py list
        python fastlane/play_games.py setup      # creates missing leaderboards/achievements

Auth: the Play service account JSON at $SUPPLY_JSON_KEY (default ~/keys/smartcraft-416312-*.json).
The key is only read here and never printed.
"""

import glob
import json
import os
import sys
from pathlib import Path

import requests
from google.auth.transport.requests import Request
from google.oauth2 import service_account

APP_ID = "151339774308"  # PLAY_GAMES_APP_ID
BASE = "https://www.googleapis.com/games/v1configuration"
UPLOAD = "https://www.googleapis.com/upload/games/v1configuration"
ROOT = Path(__file__).resolve().parent.parent

# Same items as iOS (fastlane/Fastfile GC_LEADERBOARDS / GC_ACHIEVEMENTS); key = badge / code key.
LEADERBOARDS = [
    {"key": "fiveTrades", "name": "5 Trades top stacks", "suffix": "bucks"},
]
ACHIEVEMENTS = [
    ("firstTrade", "First Trade", "Close your first trade.", 10),
    ("leverage10x", "10x Degen", "Open a trade at 10x leverage or more.", 20),
    ("rounds100", "Centurion", "Play 100 rounds.", 100),
    ("liquidated", "Margin Called", "Get liquidated.", 10),
    ("sprintDouble", "Double Up", "Finish a 60s Sprint at +100% or better.", 50),
    ("fiveTradesDone", "Five and Done", "Complete a 5 Trades run.", 20),
    ("fiveTradesPerfect", "Perfect Five", "Win all five trades in a 5 Trades run.", 75),
    ("fiveTradesDouble", "Five to Double", "Finish a 5 Trades run at +100% or better.", 75),
    ("quizFirstCorrect", "Called It", "Call a Pop Quiz pattern correctly.", 10),
    ("quizStreak5", "Hot Streak", "Get 5 Pop Quiz calls right in a row.", 40),
    ("quizStreak10", "Chart Whisperer", "Get 10 Pop Quiz calls right in a row.", 80),
    ("trainingFirstGreen", "Green Wheels", "Close a profitable trade in Training Wheels.", 10),
    ("trainingPlus50", "Paper Hands Up", "Reach +50% in a Training Wheels session.", 50),
    ("netProfit1k", "Four Figures", "Reach $1,000 all-time net profit.", 50),
    ("netProfit10k", "Five Figures", "Reach $10,000 all-time net profit.", 100),
]


def session():
    key_path = os.environ.get("SUPPLY_JSON_KEY") or sorted(glob.glob(os.path.expanduser("~/keys/smartcraft-416312-*.json")))[0]
    creds = service_account.Credentials.from_service_account_file(
        key_path, scopes=["https://www.googleapis.com/auth/androidpublisher"]
    )
    creds.refresh(Request())
    s = requests.Session()
    s.headers["Authorization"] = f"Bearer {creds.token}"
    return s


def check(response):
    if not response.ok:
        sys.exit(f"{response.request.method} {response.url} failed ({response.status_code}): {response.text[:600]}")
    return response.json() if response.text else {}


def translated(text):
    return {"kind": "gamesConfiguration#localizedStringBundle",
            "translations": [{"kind": "gamesConfiguration#localizedString", "locale": "en-US", "value": text}]}


def name_of(item):
    return item["draft"]["name"]["translations"][0]["value"]


def list_items(s):
    boards = check(s.get(f"{BASE}/applications/{APP_ID}/leaderboards", params={"maxResults": 200})).get("items", [])
    achievements = check(s.get(f"{BASE}/applications/{APP_ID}/achievements", params={"maxResults": 200})).get("items", [])
    return boards, achievements


def upload_icon(s, resource_id, image_type, path):
    with open(path, "rb") as f:
        check(s.post(f"{UPLOAD}/images/{resource_id}/imageType/{image_type}",
                      params={"uploadType": "media"}, data=f.read(), headers={"Content-Type": "image/png"}))


def setup(s):
    boards, achievements = list_items(s)
    ids = {"leaderboards": {}, "achievements": {}}
    existing_boards = {name_of(b): b["id"] for b in boards}
    for board in LEADERBOARDS:
        if board["name"] in existing_boards:
            ids["leaderboards"][board["key"]] = existing_boards[board["name"]]
            continue
        created = check(s.post(f"{BASE}/applications/{APP_ID}/leaderboards", json={
            "kind": "gamesConfiguration#leaderboardConfiguration",
            "token": board["key"],
            "scoreOrder": "LARGER_IS_BETTER",
            "draft": {
                "kind": "gamesConfiguration#leaderboardConfigurationDetail",
                "name": translated(board["name"]),
                "scoreFormat": {"numberFormatType": "NUMERIC", "suffix": {"few": translated(board["suffix"]), "many": translated(board["suffix"]), "one": translated("buck"), "other": translated(board["suffix"]), "two": translated(board["suffix"]), "zero": translated(board["suffix"])}},
                "sortRank": 3,
            },
        }))
        ids["leaderboards"][board["key"]] = created["id"]
        print("created leaderboard", board["name"])
    existing = {name_of(a): a["id"] for a in achievements}
    for order, (key, name, description, points) in enumerate(ACHIEVEMENTS, start=1):
        if name in existing:
            ids["achievements"][key] = existing[name]
            continue
        created = check(s.post(f"{BASE}/applications/{APP_ID}/achievements", json={
            "kind": "gamesConfiguration#achievementConfiguration",
            "token": key,
            "achievementType": "STANDARD",
            "initialState": "REVEALED",
            "draft": {
                "kind": "gamesConfiguration#achievementConfigurationDetail",
                "name": translated(name),
                "description": translated(description),
                "pointValue": points,
                "sortRank": order,
            },
        }))
        upload_icon(s, created["id"], "ACHIEVEMENT_ICON", ROOT / "store" / "achievements" / f"{key}.png")
        ids["achievements"][key] = created["id"]
        print("created achievement", name)
    print(json.dumps(ids, indent=2))


if __name__ == "__main__":
    s = session()
    if sys.argv[1:] == ["setup"]:
        setup(s)
    else:
        boards, achievements = list_items(s)
        print("leaderboards:", [(name_of(b), b["id"]) for b in boards])
        print("achievements:", [(name_of(a), a["id"]) for a in achievements])
