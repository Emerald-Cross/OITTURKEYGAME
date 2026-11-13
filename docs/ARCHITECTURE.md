# Christmas hit path and design

Derived from OIT Turkey Hunt at `eddb6f42aed1faa3c7187429465cf8c12dd48f10`, inspected November 13, 2026. The source tree contains no AGENTS.md. The scanner buffering, direct WebSocket event path, and authoritative scoring are retained.

## New path

1. The adapted scanner buffer calls back synchronously on Enter. No debounce. It clears incomplete input after a one-second gap or focus change.
2. The capture page sends a JSON event over its existing WebSocket. Each Enter has a random browser-instance ID plus increasing sequence. Short payloads are SNOW, GIFT, SANTA, DEER; round and target-incarnation IDs are software metadata, not QR data.
3. One Node event loop validates role/color, round identity, event identity, active phase, deadline, current turn, active target, and incarnation. It clears a snowman and awards streak-adjusted points, or records a once-per-player hold-fire targets penalty, synchronously.
4. The server broadcasts updated state plus a hit event immediately, then acknowledges the capture page. The TV updates the DOM in that message handler and flashes damage. Different sockets cannot interleave inside this synchronous mutation.
5. Persistence is absent from active hits. At round completion only, the score store queues a file write and atomic rename, without blocking display publication. Save errors remain visible and are retried every five seconds.

Native browser WebSockets and a vendored Faye server replace the old Socket.IO invalidation plus HTTP path. This retains the persistent Node event model and the proven scanner buffering pattern while removing the database round trips and display refetch. Package downloads were blocked during implementation; the small runtime dependencies are bundled with original licenses so runtime startup does not need network access.

## Consistency and recovery

- Duplicate event IDs are scoped to a color and round and return the original result with `duplicate: true`; no rebroadcast, new scoring, or repeated penalty. Rejected submissions are remembered too. The map has a 20,000-submission limit per round; each reset discards it.
- Fresh IDs identify separate trigger events. A snowman is claimable once per appearance. Wildlife can penalize each participating color once per appearance; subsequent fresh deliveries are rejected until the next appearance. There is no cross-target shot cooldown.
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

`public/encounters.js` is the shared animal/rule and timing source. Snowman and gold-present scans clear the animal in one event. Santa and reindeer codes are hold-fire targets. The server shuffles a balanced eight-animal bag, starts each round with a snowman, and chooses the illustrated path. Clients receive the current encounter, never future bag contents.

Approach, peek, and dodge take 450/150/200 ms. Scoring exposures last five seconds and hold-fire targets exposures three. A scoring hit hides the QR synchronously, gives a 450 ms impact transition, and starts the next 800 ms approach: 1.25 seconds to the next scan window. Expiry and turn changes remain on the 50 ms timer, but every scan also calls `tick()` so reveal/conceal and round boundaries are exact even between timer callbacks.

Each player has score, hits/clears, mistakes, streak, and best streak. Three clean hits unlock the next ×2 multiplier; six unlock ×3. A hold-fire targets scan deducts the smaller of 25 or the player's current score and resets their streak. The encounter records which colors were penalized, preventing held-trigger drains. Duplicate event IDs return the original outcome without applying it again. An opponent claiming a snowman is not a mistake for a losing scan. Avoiding hold-fire targets and missing a snowman do not reset clean trigger decisions.

`public/scene.js` keeps the one QR square, steady, and untinted during each reveal. Gold uses its own vector art; no color filter reaches the code. Snowman clears can use large effects because the code has already been hidden; penalty feedback stays above a hold-fire targets QR. The original full-body movement fix remains in place: landscape layers provide cover, with no crop mask on the animal. Reduced motion suppresses travel and tumbling without changing decisions or scoring.

The score record includes `christmas-v1`. `ScoreStore.board(ruleset)` filters displayed history for compatible scoring, while retaining older rounds on disk. Scanner buffering, volatile WebSocket delivery, appearance IDs, role gates, the two-minute deadline, 15-second turns, synchronous authoritative publication, and asynchronous end-of-round storage remain in place.


## Christmas isolation

The branch has new SNOW/GIFT/SANTA QR payloads and retains DEER for reindeer. Its WebSocket subprotocol is oit-christmas-v1. ScoreStore filters the leaderboard to christmas-v1, retaining other rounds on disk if an existing data directory is deliberately reused. Use a separate service/folder for each edition. Render can use ephemeral storage; no environment guard requires a persistent disk.
