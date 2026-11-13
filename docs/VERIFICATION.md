# Verification — quick-draw rules

`npm run check` runs 27 engine, real WebSocket, HTTP, storage, and capture tests. These cover one-scan clears, race winners, gold points, streak thresholds/cap/reset, once-per-color wildlife penalties, a zero score floor, safe holds, duplicate and stale deliveries, exact exposure and round boundaries, shuffled bag balance, the 1.25-second handoff, alternating/solo play, reset, ruleset-filtered storage, and the existing scanner buffer.

`npm run test:browser` uses actual Chromium and the real server with a controlled test clock. It exercises keyboard scanner input, one-scan clear visibility, duplicate/race handling, gold art, shoot/hold-fire labels, score multipliers, protected-animal penalties, help isolation, clean holds, expiry without a server packet, scanner and TV reconnection, multiple TVs, fullscreen, deadline, modes, results/reset, escaped names, optional sound, reduced motion, and mobile capture.

The visual checks inspect all four animal types through all four paths at 1920×1080, 1440×900, and 390×844. Exactly one square QR must be visible; its entire quiet zone must fit the scene and remain clear of labels, scores, hints, and controls. Filters on the QR and its ancestors must remain disabled, including for gold turkeys. Moving sprites must not use body clipping or masks. QR width is checked at a minimum 440 px at 1080p and 370 px at 1440×900.

The existing read-only CI workflow runs these checks and captures screenshots in the `turkey-hunt-screens` artifact. Local Chromium is blocked by this workspace's Unix-socket policy, so browser rendering runs in CI. Set `TURKEY_SCREENSHOT_DIR` to capture images when running locally.

A physical scanner and event TV are not available here. Rehearse one-scan claims, choosing not to scan deer/bears, the new handoff pace, and wildlife penalty behavior with the actual scanners. Software checks do not measure optical decoding or physical TV latency, and a user playtest is still needed to judge the new loop's fun.
