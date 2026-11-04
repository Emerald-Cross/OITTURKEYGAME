# OIT Turkey Shoot

A small two-player scanner shooting gallery, derived from the scanner capture and Node event model in [ghostpatrolmk1](https://github.com/Emerald-Cross/ghostpatrolmk1). The Halloween repository is untouched.

**Three pages. One TV. Green and red scanners. Immediate authoritative damage over WebSockets.** Graphics and gameplay values are provisional.

## Start

1. Install Node.js **22.9–24**. Extract this folder onto the computer driving the TV.
2. Open a terminal in `OITTURKEYGAME` and run `npm start` (or `node server.mjs`). No package installation, database account, passwords, or build step is required. The WebSocket runtime and licenses are included.
3. Open `http://localhost:3000/gallery` on the TV workstation. Connect the TV by cable, select the display, and use **Full screen** if desired.
4. On East, open `http://HOST-IP:3000/scan/green`; on Student Main, open `http://HOST-IP:3000/scan/red`. Replace `HOST-IP` with the server computer's LAN address. All three pages must use the same host. The office network must allow access to port 3000; do not change firewall policy without authorization.
5. Enter names on the gallery or scanner pages. Choose a mode on the gallery. Click **Arm scanner capture** on each capture page and leave that browser window active. Click **Start 2-minute round** on the gallery.
6. Scan on-screen targets. Each scan must end with **Enter / carriage return**. The round ends at two minutes. Final scores are saved automatically. **Next group** clears names, scores, and target health while keeping scanner pages connected.
7. After the last round shows **Completed scores saved**, stop the server with Ctrl+C. Back up the `data` folder with the game for the next event.

If the TV and a scanner share a computer, use extended desktop: leave the gallery visible on the TV while keeping the capture window focused on the workstation. A capture page cannot receive keyboard input when another application or tab has focus. The gallery reports offline, inactive, and unarmed scanners. Close extra capture tabs for the same color.

## Pages

| Path | Use |
| --- | --- |
| `/` or `/gallery` | TV gallery, live scores, round controls, persistent leaderboard |
| `/scan/green` | Green scanner capture; East workstation |
| `/scan/red` | Red scanner capture; Student Main workstation |
| `/healthz` | Server health and score-save status |

## Provisional gameplay

- **Two-minute hard deadline.** Both players shoot at the same target health. First arrival at the server is applied first.
- **Together:** both scanners score throughout the round.
- **Alternating:** 15-second turns, chosen starting color; eight turns give each player 60 seconds. Target health is shared across turns.
- **Single player:** choose either green or red; only that player's score enters the leaderboard.
- **TKY1:** 1 HP, 10 points per hit. **TKY4:** 4 HP, 25 per hit. **BEAR:** 6 HP, 40 per hit. Points belong to the player delivering each hit; the final hit also earns a clearance count, without bonus points.
- Defeated targets hide their code immediately and return at full health after **1.8 seconds**. Targets drift slowly. Deer and squirrels are scenery with no codes and cannot score. Reduced-motion preferences stop drift.
- Fresh repeated scans of a target are legitimate: **no software shot cooldown**. A retry of the same event ID never adds damage.
- Names are 1–24 visible characters. The leaderboard stores completed results, shows the best 50 overall, and displays eight at once with a mode filter. Early staff-ended rounds are also saved; they are marked in the stored round record.
- Starting does not require connected scanners, so software simulation and one-scanner setup work. Check capture status before a real round.

## Test without hardware

Start a round, then expand **Test without a scanner** on each capture page. Click **Scan TKY1**, **Scan TKY4**, or **Scan BEAR**. Both colors use the same server hit handler as hardware.

With capture armed and the simulator open, keys **1**, **4**, and **B** trigger simulated shots. Keep the simulator closed during real scanner use. **Repeat last network delivery** resends the identical event ID: health and score must stay unchanged. Alternatively, with the simulator closed, type `TKY4` then press Enter to exercise scanner buffering.

Run `npm run check` for engine, transport, storage, HTTP, and real WebSocket integration tests. Optional Chromium interaction tests: `npm install --no-save playwright`, `npx playwright install chromium`, then `npm run test:browser`. `BROWSER_EXECUTABLE` can select an installed Chromium binary. See [verification](docs/VERIFICATION.md) for the actual execution status.

## Storage and deployment

The active round lives in **one Node process**. Completed rounds are written asynchronously to `data/scores.json` using atomic replacement, with visible errors and automatic retry. Set `DATA_DIR` to a different durable directory if needed; `PORT` defaults to 3000. An optional `.env` is read automatically; no `.env` is needed for local use.

A browser disconnect recovers the current round from the server. A **server restart aborts the active round**, starts a fresh lobby with a fresh ID, and reloads completed leaderboards. Unsaved rounds can be lost on power loss or a forced termination; wait for the save confirmation before stopping. This first version does not persist every in-progress hit or use Supabase.

Use this password-free version on a trusted event LAN. Anyone with network access can open the gallery and operate round controls; scanner colors are station assignments rather than authentication. Internet exposure requires an access layer. Run only **one server process** against the data directory.

For Render, the file-backed leaderboard requires a persistent disk and a single instance. Render Free's ephemeral filesystem cannot retain these scores; do not deploy this version to Render Free expecting durable scores. See [deployment](docs/DEPLOYMENT.md).

## Engineering and timing

The TV applies health and score changes in its message handler, then flashes the damaged target. It never waits for a poll, database read, page reload, or animation to complete. The 50 ms server timer handles respawns, turn changes, and the round deadline; it is **not** the hit processing path.

Capture diagnostics show **Enter/click → acknowledgement** round trip. Gallery diagnostics show server handler duration, browser DOM update duration, receipt → requestAnimationFrame callback, and server receipt → TV frame callback → server return. These are software measurements. They **exclude optical decoding and physical TV response**, and a frame callback does not prove that pixels have appeared. No subtraction of clocks on different computers is used. See [architecture](docs/ARCHITECTURE.md).

Actual S740 keyboard output, repeated-scan behavior, browser focus on the event workstations, office-network connections, and cabled TV response still need rehearsal.
