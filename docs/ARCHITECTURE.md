# Hit path and design

## Inspected source

Source: `Emerald-Cross/ghostpatrolmk1`, default-branch tree `e3606dfbaeb9f7afd3a6dfbb3d4bc8bff70d6bc0`, inspected November 4, 2026. Read README, docs/DEPLOYMENT.md, server.mjs, public/scanner.js, public/app.js, public/realtime.js, api/game.js, lib/game.mjs, lib/store.mjs and lib/render-server.mjs. Its recursive repository tree contains no AGENTS.md. The user's OIT Turkey Hunt project context was applied.

The old capture handler immediately posts an HTTP scan at Enter. The API performs a Supabase read and compare-and-swap transaction before `onState` calls `notifyStateChange`. Socket.IO broadcasts a `game:changed` invalidation, with no state. The TV then fetches `/api/game` and renders. Polling also exists as fallback (2 seconds for boss/scanner views; 15 seconds for some other displays). It would be inaccurate to describe every live hit as waiting for polling. The boss also has a 1.2-second per-player rearm rule, which is not retained here.

## New path

1. The adapted scanner buffer calls back synchronously on Enter. No debounce. It clears incomplete input after a one-second gap or focus change.
2. The capture page sends a JSON event over its existing WebSocket. Each Enter has a random browser-instance ID plus increasing sequence. Short payloads are TKY1, TKY4, BEAR; round and target-incarnation IDs are software metadata, not QR data.
3. One Node event loop validates role/color, round identity, event identity, active phase, deadline, current turn, active target, and incarnation. It clears a turkey and awards streak-adjusted points, or records a once-per-player wildlife penalty, synchronously.
4. The server broadcasts updated state plus a hit event immediately, then acknowledges the capture page. The TV updates the DOM in that message handler and flashes damage. Different sockets cannot interleave inside this synchronous mutation.
5. Persistence is absent from active hits. At round completion only, the score store queues a file write and atomic rename, without blocking display publication. Save errors remain visible and are retried every five seconds.

Native browser WebSockets and a vendored Faye server replace the old Socket.IO invalidation plus HTTP path. This retains the persistent Node event model and the proven scanner buffering pattern while removing the database round trips and display refetch. Package downloads were blocked during implementation; the small runtime dependencies are bundled with original licenses so runtime startup does not need network access.

## Consistency and recovery

- Duplicate event IDs are scoped to a color and round and return the original result with `duplicate: true`; no rebroadcast, new scoring, or repeated penalty. Rejected submissions are remembered too. The map has a 20,000-submission limit per round; each reset discards it.
- Fresh IDs identify separate trigger events. A turkey is claimable once per appearance. Wildlife can penalize each participating color once per appearance; subsequent fresh deliveries are rejected until the next appearance. There is no cross-target shot cooldown.
- Every animal appearance has a new ID, including a retreating survivor. A packet from a previous appearance cannot damage a returning animal, even if its QR payload is identical.
- Disconnected clients do not queue scans. Pending acknowledgements fail on disconnect. Unconfirmed accepted hits can still appear on the TV; no automatic replay occurs. A reconnect fetches a full snapshot over the new socket, preserving the server's health and scores. Pings detect dead connections; detection of a physical network failure is not instantaneous.
- A server restart assigns a new round ID, rejecting packets from the aborted round. Completed leaderboards reload from disk. Active rounds intentionally do not resume.
- All clients receive the same authoritative state. Multiple capture tabs for one color are reported but not blocked; close extras before play.
- This is one trusted game room, one Node process, one score directory. No passwords, per-person authentication, cross-process state synchronization, or hidden control screen.

## Timing diagnostics

| Measurement | Clock | Meaning |
| --- | --- | --- |
| Enter/click to acknowledgement | Capture `performance.now()` | Submission + network round trip + server handler; not optical scan time |
| Server handler | Server monotonic clock | Validation and synchronous game mutation; excludes snapshot encoding and transmission |
| TV DOM update | TV `performance.now()` | Message receipt through synchronous render handler |
| Receipt to rAF | TV monotonic clock | Time to a frame scheduling callback; not verified physical paint |
| Server receipt → TV rAF → server | Server monotonic clock | Includes outbound delivery, browser scheduling, and return network leg; not one-way TV latency |

No cross-device wall-clock subtraction is used for these metrics. The game countdown uses the latest server timestamp as an approximate offset; deadline enforcement always happens on the server. The server retains traces for ten seconds and only accepts matching trace IDs from gallery sockets.

To measure physical response, film scanner trigger/beep and the cabled TV together at high frame rate. Count frames over repeated shots and report median and slow cases, together with the software diagnostics. This adds scanner decoding, OS input delivery, and TV display delay that software instrumentation cannot capture here.

## One-scan reaction loop

`public/encounters.js` is the shared animal/rule and timing source. Turkey and gold-turkey scans clear the animal in one event. Deer and bear codes are hold-fire targets. The server shuffles a balanced eight-animal bag, starts each round with a normal turkey, and chooses the illustrated path. Clients receive the current encounter, never future bag contents.

Approach, peek, and dodge take 450/150/200 ms. Turkey exposures last five seconds and wildlife exposures three. A scoring hit hides the QR synchronously, gives a 450 ms impact transition, and starts the next 800 ms approach: 1.25 seconds to the next scan window. Expiry and turn changes remain on the 50 ms timer, but every scan also calls `tick()` so reveal/conceal and round boundaries are exact even between timer callbacks.

Each player has score, hits/clears, mistakes, streak, and best streak. Three clean hits unlock the next ×2 multiplier; six unlock ×3. A wildlife scan deducts the smaller of 25 or the player's current score and resets their streak. The encounter records which colors were penalized, preventing held-trigger drains. Duplicate event IDs return the original outcome without applying it again. An opponent claiming a turkey is not a mistake for a losing scan. Avoiding wildlife and missing a turkey do not reset clean trigger decisions.

`public/scene.js` keeps the one QR square, steady, and untinted during each reveal. The gold filter is on the sprite alone. Turkey clears can use large effects because the code has already been hidden; penalty feedback stays above a wildlife QR. The original full-body movement fix remains in place: landscape layers provide cover, with no crop mask on the animal. Reduced motion suppresses travel and tumbling without changing decisions or scoring.

The score record includes `quickdraw-v1`. `ScoreStore.board(ruleset)` filters displayed history for compatible scoring, while retaining older rounds on disk. Scanner buffering, volatile WebSocket delivery, appearance IDs, role gates, the two-minute deadline, 15-second turns, synchronous authoritative publication, and asynchronous end-of-round storage remain in place.
