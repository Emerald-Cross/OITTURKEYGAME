# OIT Turkey Hunt

A two-player scanner reaction game, derived from the scanner capture and Node event model in [ghostpatrolmk1](https://github.com/Emerald-Cross/ghostpatrolmk1). The Halloween repository is untouched.

**Three pages. One TV. Green and red scanners. Immediate authoritative damage over WebSockets.** The gallery uses an illustrated autumn woodland, with matching hunter stations and optional synthesized sound.

## Start

1. Install Node.js **22.9–24**. Extract this folder onto the computer driving the TV.
2. Open a terminal in `OITTURKEYGAME` and run `npm start` (or `node server.mjs`). No package installation, database account, passwords, or build step is required. The WebSocket runtime and licenses are included.
3. Open `http://localhost:3000/gallery` on the TV workstation. Connect the TV by cable, select the display, and use **Full screen** if desired.
4. On East, open `http://HOST-IP:3000/scan/green`; on Student Main, open `http://HOST-IP:3000/scan/red`. Replace `HOST-IP` with the server computer's LAN address. All three pages must use the same host. The office network must allow access to port 3000; do not change firewall policy without authorization.
5. On the gallery, click **Set up hunt** to open camp. Enter names there or on the scanner pages, and choose a mode. Click **Arm scanner capture** on each capture page and leave that browser window active. Click **Start hunt** in camp.
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

## Gameplay

- **One scan clears a turkey.** Normal turkeys are worth 10 base points; gold turkeys are worth 30. The first successful scan claims the animal and immediately hides its code.
- **Hold fire for deer and bears.** Scanning either costs up to 25 points and resets that player's streak. Scores never fall below zero. Each player can incur the penalty only once per animal appearance, even with a held trigger. The other player can still make their own decision.
- **Build a clean-hit streak.** The first three hits use ×1; the next three use ×2; subsequent hits use ×3. A wildlife mistake resets the multiplier. Other players' clears, safe holds, and unclaimed turkeys do not break your clean trigger decisions. Best streak and mistakes are recorded in results.
- **One large, steady code.** Animal approach/peek/dodge takes 0.8 seconds. Turkey codes remain available for five seconds, wildlife codes for three. A cleared animal gives way to the next scannable target after **1.25 seconds**. Each shuffled bag contains four normal turkeys, two gold turkeys, a deer, and a bear. All players see the same server-selected animal and path.
- **Two-minute hard deadline.** Head-to-head uses both scanners; the first accepted shot wins that target. Alternating play retains 15-second turns and a chosen starting scanner. Solo play supports either color. Only participating players enter the leaderboard.
- **No replayed shots.** Reusing a network event ID never changes points, streaks, or penalties again. Repeated scans of a cleared target are ignored; each new animal appearance has a new ID.
- The gold tint affects only animal art, leaving its QR pure black/white. Codes are approximately 460 px square on a 1080p TV. Full animal sprites remain visible while moving; reduced motion keeps the same decision windows.
- Names are 1–24 visible characters. Current-rules leaderboards keep the best 50 and show eight. Earlier scoring records remain stored separately and are not mixed with the new rules.
- Starting does not require connected scanners, allowing software simulation and one-scanner setup. Check capture status before a real round.

## In the woods

The verified Chromium workflow captures the welcome screen, camp, each body-code reveal, feather hits, results, fullscreen play, and scanner/mobile layouts. Download `turkey-hunt-screens` from the latest [Game checks run](https://github.com/Emerald-Cross/OITTURKEYGAME/actions/workflows/verify.yml).

The TV fills the browser with an illustrated woodland. **Set up hunt** opens camp: enter names, choose **Head-to-head**, **Take turns**, or **Solo hunt**, and start. Camp closes automatically. The scoring HUD floats over the scene; setup and diagnostics stay tucked away under **Camp & scores**. Full screen removes browser chrome.

One animal steps into the foreground and exposes its body code. Scan a turkey, or hold fire for wildlife. Turkey hits trigger a full feather burst, a large score pop, and an optional synthesized pop/chime. Wrong wildlife scans show a penalty above the active QR, keeping the code clear for the other player. A clean hold receives a check mark as the animal leaves. The server controls the shared animal, scoring, streaks, and decision windows.

**Next group** resets the group and reopens camp without reconnecting scanner stations. Results handle a winner, a tie, and solo play.

**How to play** opens a short field guide. Opening it on a scanner station pauses capture until it closes. **Sound off** is the default; turn it on for short hit and round cues. No audio files, external fonts, or third-party services are required. Reduced-motion preferences disable approach/retreat movement, falling leaves, and decorative animation. Codes retain the same scan timing.

## Test without hardware

Start a round, then expand **Test without a scanner** on each capture page. Click **Scan TKY1** or **Scan TKY4** to clear the exposed turkey. **Scan BEAR** and **Scan DEER** exercise the hold-fire penalty. Hidden animals are intentionally rejected. Both colors use the same server hit handler as hardware.

With capture armed and the simulator open, keys **1**, **4**, **B**, and **D** trigger simulated shots. Keep the simulator closed during real scanner use. **Repeat last network delivery** resends the identical event ID: score, streak, and mistakes must stay unchanged. Alternatively, with the simulator closed, type `TKY4` then press Enter to exercise scanner buffering.

Run `npm run check` for engine, transport, storage, HTTP, and real WebSocket integration tests. Optional Chromium interaction tests: `npm install --no-save playwright`, `npx playwright install chromium`, then `npm run test:browser`. `BROWSER_EXECUTABLE` can select an installed Chromium binary. See [verification](docs/VERIFICATION.md) for the actual execution status.

## Storage and deployment

The active round lives in **one Node process**. Completed rounds are written asynchronously to `data/scores.json` using atomic replacement, with visible errors and automatic retry. Set `DATA_DIR` to a different durable directory if needed; `PORT` defaults to 3000. An optional `.env` is read automatically; no `.env` is needed for local use.

A browser disconnect recovers the current round from the server. A **server restart aborts the active round**, starts a fresh lobby with a fresh ID, and reloads completed leaderboards. Unsaved rounds can be lost on power loss or a forced termination; wait for the save confirmation before stopping. This first version does not persist every in-progress hit or use Supabase.

Use this password-free version on a trusted event LAN. Anyone with network access can open the gallery and operate round controls; scanner colors are station assignments rather than authentication. Internet exposure requires an access layer. Run only **one server process** against the data directory.

For Render, the file-backed leaderboard requires a persistent disk and a single instance. Render Free's ephemeral filesystem cannot retain these scores; do not deploy this version to Render Free expecting durable scores. See [deployment](docs/DEPLOYMENT.md).

## Engineering and timing

The TV applies target and score changes in its message handler, then flashes the damaged target. It never waits for a poll, database read, page reload, or animation to complete. The 50 ms server timer handles respawns, turn changes, and the round deadline; it is **not** the hit processing path.

Capture diagnostics show **Enter/click → acknowledgement** round trip. Gallery diagnostics show server handler duration, browser DOM update duration, receipt → requestAnimationFrame callback, and server receipt → TV frame callback → server return. These are software measurements. They **exclude optical decoding and physical TV response**, and a frame callback does not prove that pixels have appeared. No subtraction of clocks on different computers is used. See [architecture](docs/ARCHITECTURE.md).

Actual S740 keyboard output, repeated-scan behavior, browser focus on the event workstations, office-network connections, and cabled TV response still need rehearsal.

