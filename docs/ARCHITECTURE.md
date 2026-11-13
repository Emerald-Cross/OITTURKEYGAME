# Christmas game architecture

Derived from OIT Turkey Hunt at `eddb6f42aed1faa3c7187429465cf8c12dd48f10`, inspected November 13, 2026. The source tree contains no AGENTS.md. The scanner buffer, direct WebSocket path, authoritative game loop, and asynchronous score store are retained.

## Immediate scan path

1. `public/scanner.js` emits the buffered payload synchronously at Enter. No debounce. An incomplete code expires after a one-second input gap or a focus change.
2. The station sends a scan over its existing WebSocket with the round ID, appearance ID, and a unique event ID. Codes are SNOW, GIFT, SANTA, and DEER. Software metadata is not encoded into the QR.
3. One Node event loop checks station role/color, round, event, active phase, deadline, current turn, target visibility, and appearance. It synchronously claims the scoring target or applies a once-per-player hold-fire penalty.
4. The server publishes the authoritative state and hit before acknowledging the station. The TV applies score and code visibility in the message handler. No database, poll, page reload, or animation blocks this path.
5. Completed rounds save through atomic file replacement. Errors remain visible and retry every five seconds. Active hits never wait for disk writes.

A 50 ms timer handles reveal/retreat transitions, turns, and deadlines. Every scan also runs the boundary checks, so it cannot score after the exact deadline or outside the reveal window between timer callbacks.

## Choices and timing

`public/encounters.js` defines shared targets, scoring, paths, and timing. The server shuffles four snowmen, two gold presents, Santa, and a reindeer. A round starts with a snowman. Hold-fire encounters are kept apart when the remaining bag allows it. Clients do not receive future bag contents.

Approach, peek, and dodge take 450/150/200 ms. Scoring codes are then available for five seconds; hold-fire codes for three. A clear immediately hides the QR, gives a 450 ms snow/ribbon impact, and begins the next 800 ms approach: 1.25 seconds to the next scan window.

Each player has points, clears, mistakes, streak, and best streak. Three clean hits unlock the next ×2 multiplier; six unlock ×3. Scanning Santa or reindeer deducts at most 25 points and resets that player's streak. Scores never fall below zero. The encounter tracks penalized colors to prevent repeated-trigger drains. An opponent's clear, an unclaimed target, and a clean hold do not reset a streak.

## Consistency and recovery

- Event IDs are scoped to color and round. Duplicate delivery returns the original outcome without scoring or rebroadcasting again. Rejected submissions are remembered too. A round permits up to 20,000 submissions.
- Every appearance has a fresh ID. Delayed scans cannot affect a later appearance of the same code.
- Disconnected stations drop scans. Pending acknowledgements fail on disconnect; submissions are never automatically replayed. A reconnect receives the current authoritative snapshot.
- Server restart creates a fresh lobby and round ID. Completed scores reload when the underlying filesystem survives. Active rounds do not resume.
- One Node process owns the game and score directory. Multiple scanner tabs for a color are reported; close extras. Gallery controls are password-free and scanner colors identify stations.

## Scene and accessibility

`public/scene.js` presents one complete billboard character and one QR. The code stays square, still, unfiltered, and pure black/white throughout its scan window. Gold uses separate vector art. Santa and the reindeer retain active codes after one player's mistake so the other player can make a decision. Penalty feedback stays above the code; large impacts begin only after a scoring code is hidden.

No crop mask cuts off a character's lower body. Foreground boughs provide visual cover at the edges. Reduced motion suppresses travel, snowfall, and tumbling while retaining scan windows and static feedback. Instructions pause input on scanner pages. Sounds require a gesture and start muted.

## Seasonal isolation and hosting

This edition uses the `oit-christmas-v1` WebSocket subprotocol and `christmas-v1` score ruleset. `ScoreStore.board(ruleset)` filters visible history without deleting other editions' records. Run Christmas and turkey in separate folders/processes or services.

Render can use ephemeral local scores with no persistent disk or environment guard. A restart may clear history and always aborts active play. DATA_DIR optionally selects a durable directory. The server binds to 0.0.0.0 and uses PORT, defaulting to 3000.

## Timing diagnostics

| Measurement | Clock | Meaning |
| --- | --- | --- |
| Enter/click → acknowledgement | Station performance clock | Submission, round trip, and server processing |
| Server handler | Server monotonic clock | Validation and synchronous mutation |
| TV DOM update | TV performance clock | Receipt through synchronous render |
| Receipt → frame callback | TV monotonic clock | Scheduling callback wait |
| Server receipt → TV frame callback → server | Server monotonic clock | Delivery, browser scheduling, and return leg |

No subtraction of different computers' clocks is used. These figures exclude optical decoding and physical TV response. A frame callback does not prove physical paint. Rehearse the actual scanner/network/TV arrangement to measure that end-to-end response.
