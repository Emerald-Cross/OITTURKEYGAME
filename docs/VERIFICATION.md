# Verification — November 9, 2026

`npm run check` passes **21 tests** locally and in CI on Node 24.22.1. This includes the complete encounter timeline, exact reveal/conceal boundaries, the one-active-target invariant across a full round, shared health, repeated shots without cooldown, duplicate deliveries, retained damage, stale appearance rejection, clearing and returning at full health, modes, deadlines, reset, scanner capture, real WebSockets, reconnect, HTTP, persistence, and diagnostics.

The full Chromium suite passed in [Game checks run 42688670300](https://github.com/Emerald-Cross/OITTURKEYGAME/actions/runs/42688670300), on source commit `da002967eaee4e417cf45c0c5f73987b637c4d54`. Local Chromium cannot start under this workspace’s Unix-socket restrictions, so browser verification ran on the repository’s runner.

## Browser coverage

- Exactly one visible QR, integrated into the current animal’s body. Its grid is square and still throughout the reveal, with no tint or image filter.
- All eight consecutive encounter variants checked at **1920 × 1080**, **1440 × 900**, and **390 × 844**. The full QR and quiet zone fit inside the scene. Animal labels, hints, scores, and controls do not overlap the code.
- QR width at least **440 px on a 1080p TV** (approximately 460 px with the default layout), and at least **370 px at 1440 × 900**.
- Hidden animals cannot score. The TV hides an expired code locally even before a concealment packet arrives. Lethal damage removes the code immediately; nonlethal damage preserves the scan area.
- Both capture pages receive Enter-terminated scans. Repeated hits, shared health, duplicate delivery, help-dialog isolation, damage retention across hiding, and stale appearances are verified.
- Scanner and TV reconnection recover authoritative state. A second TV joins the same encounter. A reconnecting TV waits for a fresh snapshot before revealing its code.
- The hard deadline works with camp open; results, score saving, next-group reset, alternating turns, red solo play, escaped names, fullscreen, and reduced motion pass.

The workflow captures the woodland lobby, camp, each animal’s exposed body code, feather hits, results, fullscreen play, mobile gallery, and mobile scanner. Download the `turkey-hunt-screens` artifact from the linked run. Screenshots are captured in Chromium; automated geometry checks verify layout.

## Physical rehearsal

The original QR SVGs and scanner buffer are unchanged. A physical scanner or event TV was not available for this update. Check the new code patches at the actual playing distance and confirm the 5.2–7.2 second exposure windows suit the scanners. Software timings exclude optical decoding and physical TV response.

The woodland animates the existing illustrated sprites through a CSS 3D perspective scene. No hosting settings or score-storage configuration were changed.
