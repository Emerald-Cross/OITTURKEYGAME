# Merry Mayhem · OIT Christmas Arcade

A Christmas edition of [OIT Turkey Hunt](https://github.com/Emerald-Cross/OITTURKEYGAME), isolated on the **christmas** branch. Turkey main and the Halloween game are unchanged. See [FORK.md](FORK.md) for the source commit and independent-repository handoff.

**One TV. Green and red scanners. One large code at a time.** Snowmen dart out of a moonlit village, gold presents earn a bonus, and Santa and reindeer test your trigger discipline. Original vector art, falling snow, strong snow/ribbon impacts, and optional synthesized bells. No external assets, database, passwords, build step, or package installation.

## Start

1. Install Node.js **22.9–24**. Open the project folder and run `npm start`.
2. Open `http://localhost:3000/gallery` on the TV computer. Use extended desktop if a scanner shares that computer.
3. On East, open `http://HOST-IP:3000/scan/green`. On Student Main, open `http://HOST-IP:3000/scan/red`. All pages must use the same server host; replace `HOST-IP` with its LAN address.
4. Click **Let’s play**, enter names, and choose **Head-to-head**, **Take turns**, or **Solo run**. On each scanner page, click **Arm scanner capture** and keep its window active. Start with **Let it snow**.
5. Scan the exposed code on a snowman or gold present. Leave Santa and reindeer alone. Scanner output must end with **Enter / carriage return**.
6. The round ends after two minutes. **Next group** clears names and scores while keeping the scanner pages connected. **Lodge & scores** reopens setup and the leaderboard.

| Target | Code | Decision | Base points |
| --- | --- | --- | ---: |
| Snowman | `SNOW` | Scan once | +10 |
| Gold present | `GIFT` | Scan once | +30 |
| Santa | `SANTA` | Hold fire | Up to −25 if scanned |
| Reindeer | `DEER` | Hold fire | Up to −25 if scanned |

After three clean hits, the next hit gets ×2; after six, ×3. Scanning Santa or reindeer resets your streak. A held trigger incurs at most one penalty per player per appearance. Scores never go negative. Your opponent claiming a target, a missed snowman, and a clean hold do not reset your streak.

Every shuffled bag contains four snowmen, two presents, Santa, and a reindeer. Each round begins with a snowman. Approach/peek/dodge takes 0.8 seconds; scoring codes then stay steady for five seconds and hold-fire codes for three. A successful scan hides the code immediately and hands off to the next scan window in 1.25 seconds. Codes are about **492 px square at 1080p**, pure black/white, with a four-module quiet zone. All clients share the same server-selected target and path. Reduced motion preserves the decision windows.

## Pages and controls

| Path | Use |
| --- | --- |
| `/` or `/gallery` | TV scene, live scores, lodge controls, leaderboard |
| `/scan/green` | Green scanner capture; East workstation |
| `/scan/red` | Red scanner capture; Student Main workstation |
| `/healthz` | Server and score-save status |

The gallery shows offline, inactive, and unarmed scanner stations. Close extra capture tabs for the same color. A scanner cannot receive keyboard input if another window has focus. Opening instructions on a capture page pauses capture until they close.

**Sound off** is the default. Turn sound on for snow puffs, bells, and round cues. Full screen removes browser chrome. Head-to-head uses both scanners; the first accepted scan claims a scoring target. Take turns changes the active scanner every 15 seconds. Solo supports either color. Only participating players enter the leaderboard.

## Test without hardware

Start a round, then open **Test without a scanner** on a capture page. Use **Scan SNOW**, **Scan GIFT**, **Scan SANTA**, and **Scan DEER**. Hidden targets are rejected. With capture armed and the simulator open, keys **1**, **4**, **S**, and **D** simulate those codes. Close the simulator during real scanner use. Type `SNOW` then press Enter to test real buffering.

**Repeat last network delivery** resends the identical event ID and must never add points or penalties again. All simulator actions use the real server handler.

- `npm run check`: syntax, game engine, capture buffering, transport, HTTP, WebSocket integration, and storage tests.
- `npm run test:browser`: optional Chromium interaction and layout suite. Install `playwright`, then its Chromium runtime, or set `BROWSER_EXECUTABLE` to an installed Chromium.
- `CHRISTMAS_SCREENSHOT_DIR=test-results npm run test:browser`: capture welcome, lodge, targets, impacts, results, fullscreen, and mobile stations.
- `python scripts/build-art.py`: regenerate all eight original SVG assets using only the Python standard library.
- `python scripts/generate-qr.py`: regenerate the four committed codes; development only, requires ReportLab.

See [verification](docs/VERIFICATION.md), [artwork](docs/ARTWORK.md), and [architecture](docs/ARCHITECTURE.md).

## Storage and deployment

Run **one Node process**. Active rounds live in memory. Completed scores save asynchronously to `data/scores.json`; `DATA_DIR` selects another directory and `PORT` defaults to 3000. Christmas uses its own `christmas-v1` leaderboard ruleset and `oit-christmas-v1` WebSocket protocol. Run the turkey edition in a separate folder/process.

**Render with temporary scores is supported.** No persistent disk is required. Use `npm run check` as the build command, `npm start` as the start command, and `/healthz` for health checks. Set `DATA_DIR=./data` if desired. A restart/redeploy may clear completed scores and always aborts the current round. Use a durable directory only if you later want scores to survive restarts. See [deployment](docs/DEPLOYMENT.md).

This is a password-free event game. Anyone who can access the gallery can operate round controls. Scanner colors identify stations. Physical scanner decoding, office networking, and TV response still require a rehearsal with the actual equipment.
