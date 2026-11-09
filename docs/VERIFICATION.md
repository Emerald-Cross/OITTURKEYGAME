# Verification — November 9, 2026

`npm run check` passes **21 tests** locally on Node 24.22.1. This includes the complete encounter timeline, exact reveal/conceal boundaries, the one-active-target invariant across a full round, shared health, repeated shots without cooldown, duplicate deliveries, health retention, stale appearance rejection, clearing and returning at full health, modes, deadlines, reset, scanner capture, real WebSocket clients, reconnect, HTTP, persistence, and diagnostics.

Browser verification is being run through the repository’s Chromium CI job because local Chromium cannot start under this workspace’s Unix-socket restrictions. The browser suite covers the real gallery and both scanner pages, large square and stationary body codes, hiding and expiry, health retention, repeated Enter scans, lethal visibility, help/capture isolation, duplicate delivery, reconnect, multiple TVs, TV layouts, fullscreen, camp, results, alternating and solo modes, reduced motion, and escaped names. Its result will be recorded after the run.

The original QR SVGs and scanner buffer are unchanged. No physical scanner or event TV was available for this update; a hardware rehearsal should confirm distance, code size, and exposure duration. Software timings exclude optical decoding and physical TV response.

The woodland uses perspective movement of the existing illustrated sprites. It does not introduce volumetric 3D animal models. No hosting settings or score-storage configuration were changed.
