# Hit path and design

## Inspected source

Source: `Emerald-Cross/ghostpatrolmk1`, default-branch tree `e3606dfbaeb9f7afd3a6dfbb3d4bc8bff70d6bc0`, inspected November 4, 2026. Read README, docs/DEPLOYMENT.md, server.mjs, public/scanner.js, public/app.js, public/realtime.js, api/game.js, lib/game.mjs, lib/store.mjs and lib/render-server.mjs. Its recursive repository tree contains no AGENTS.md. The user's OIT Turkey Hunt project context was applied.

The old capture handler immediately posts an HTTP scan at Enter. The API performs a Supabase read and compare-and-swap transaction before `onState` calls `notifyStateChange`. Socket.IO broadcasts a `game:changed` invalidation, with no state. The TV then fetches `/api/game` and renders. Polling also exists as fallback (2 seconds for boss/scanner views; 15 seconds for some other displays). It would be inaccurate to describe every live hit as waiting for polling. The boss also has a 1.2-second per-player rearm rule, which is not retained here.

## New path

1. The adapted scanner buffer calls back synchronously on Enter. No debounce. It clears incomplete input after a one-second gap or focus change.
2. The capture page sends a JSON event over its existing WebSocket. Each Enter has a random browser-instance ID plus increasing sequence. Short payloads are TKY1, TKY4, BEAR; round and target-incarnation IDs are software metadata, not QR data.
3. One Node event loop validates role/color, round identity, event identity, active phase, deadline, current turn, active target, and incarnation. It decrements health and awards per-hit credit synchronously.
4. The server broadcasts updated state plus a hit event immediately, then acknowledges the capture page. The TV updates the DOM in that message handler and flashes damage. Different sockets cannot interleave inside this synchronous mutation.
5. Persistence is absent from active hits. At round completion only, the score store queues a file write and atomic rename, without blocking display publication. Save errors remain visible and are retried every five seconds.

Native browser WebSockets and a vendored Faye server replace the old Socket.IO invalidation plus HTTP path. This retains the persistent Node event model and the proven scanner buffering pattern while removing the database round trips and display refetch. Package downloads were blocked during implementation; the small runtime dependencies are bundled with original licenses so runtime startup does not need network access.

## Consistency and recovery

- Duplicate event IDs are scoped to a color and round and return the original result with `duplicate: true`; no rebroadcast or new scoring. Rejected submissions are remembered too. The map has a 20,000-submission limit per round; each reset discards it.
- Fresh IDs allow legitimate repeated shots. There is no time-based target debounce.
- Every target spawn has a new ID. A packet from before defeat cannot damage the replacement, even if its QR payload is identical.
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
