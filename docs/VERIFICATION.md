# Verification — November 4, 2026

## Passed in software

`npm run check` passes **16 tests** on Node 24.22.1. These use the actual game engine, the actual bundled WebSocket implementation with real TCP connections and Node WebSocket clients, a temporary filesystem, and the browser transport in a deterministic test harness.

| Area | Verified |
| --- | --- |
| Shared combat | Green and red reduce the same health; simultaneous socket submissions do not lose updates; credit goes to the shooting color |
| Repeated shots | Fresh event IDs score immediately on the same target without cooldown |
| Duplicate delivery | Reusing an event ID adds no damage or points, including after reconnect |
| Target lifecycle | Inactive, unknown, and replaced-spawn scans rejected; respawn restores full health |
| Rounds | Exact 120-second deadline; completion callback once; resets clear names/scores/health and change round identity |
| Modes | Alternating 15-second turns from either starting color; single-player can choose red and records only that participant |
| Capture buffer | Short codes, immediate Enter callback, repeat shots, partial-input timeout, reset on focus change |
| Reconnect | Scanner reconnect receives health and score snapshot; a newly joined TV receives the same state |
| Offline delivery | Browser transport discards offline submissions, fails pending acknowledgements, never replays on reconnect |
| Roles | Scanner sockets cannot control rounds; gallery sockets cannot submit hits |
| Persistence | Completed leaderboard reloads after store restart; repeated save of the same round does not duplicate rows; write failure stays visible and retries successfully |
| Critical path | Active hit processing publishes damage without invoking score-file writes |
| Diagnostics | Matching hit/frame trace IDs produce software timing metrics using monotonic durations, without cross-device clock subtraction |
| HTTP | All three pages and QR assets served; private data and source paths unavailable; non-GET methods rejected |

## Not verified here

**Browser execution did not complete.** Chromium is installed, but launch failed with `socket() failed: Operation not permitted` before any page loaded. The alternate browser runtime also could not activate because its required runtime credential was not provisioned. No rendering, browser interaction, fullscreen, screenshots, or browser-based timing measurements are claimed.

`tests/browser.mjs` is provided for a workstation with Playwright/Chromium. It exercises all three pages, Enter-terminated scans, repeated shots, duplicate simulation, respawn, reconnect, a timed finish using an injected test clock, leaderboard, reset, editable-field capture warnings, and wide/narrow layouts. It has not passed in this environment. Run it before event use and address any failures.

**No physical S740 scanner, office network, or cabled TV trial occurred.** No optical-decoding latency, actual input delivery time, real pixel-paint time, or hardware response figure is claimed. The QR SVGs are generated from short payloads; physical scan behavior is unverified.

**No deployment occurred.** No live Render service or Supabase configuration was changed. The source repository is [Emerald-Cross/OITTURKEYGAME](https://github.com/Emerald-Cross/OITTURKEYGAME); publishing source does not deploy a running game. The old Halloween repository is untouched.

## Hardware rehearsal

1. Start the host and open `/gallery` on the cabled TV. Open `/scan/green` on East and `/scan/red` on Student Main using the same host IP.
2. Enter names, arm capture, start a simultaneous round. Verify TKY4 loses one health per scan and scores go to the proper player. Repeatedly scan it with one scanner, then alternate colors. Keep simulator closed for real scanning.
3. Move focus to a different application, then to a name field between rounds. Confirm capture warning and recovery with **Arm scanner capture**. A web page cannot force OS focus.
4. Unplug/reconnect a workstation network connection during a round; wait for recovery. Confirm fresh current state, no queued shots after reconnect, and correct subsequent credit. A physical network failure may take up to the heartbeat timeout to detect; an unconfirmed shot requires checking the TV before rescanning.
5. Verify alternating and both single-color choices, target respawns, two-minute ending, saved leaderboard, and **Next group**. Restart the server between rounds: completed scores should remain, the active lobby should be new.
6. Film repeated scans and visible TV response in the same high-frame-rate shot. Compare median and slow cases with the software diagnostics. Test TV game mode/cable/workstation settings on the actual equipment; do not treat software callback timing as measured physical display latency.
