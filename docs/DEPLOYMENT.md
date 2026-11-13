# Running Merry Mayhem

## Local event

Use Node.js 22.9–24. Run `npm start` from the project folder. The committed `vendor/` directory supplies the WebSocket runtime, so npm installation is unnecessary. One server listens on port 3000, or `PORT`. All pages use that same host.

TV: `/gallery`. East: `/scan/green`. Student Main: `/scan/red`. Keep scanner capture windows focused and armed. On a shared TV/scanner computer, use extended desktop. Keep the TV visible while capture has focus. Names and modes live in **Lodge & scores**. No database, passwords, or secrets are required.

An optional `.env` can contain:

```
PORT=3000
DATA_DIR=./data
```

Do not commit `.env`, `data/`, or root `node_modules/`. Keep `vendor/`.

## Render with temporary scores

The event configuration allows a fresh game for every Render instance. **A persistent disk is optional.**

| Setting | Value |
| --- | --- |
| Source branch | `christmas` |
| Runtime | Node 24 |
| Build command | `npm run check` |
| Start command | `npm start` |
| Health check | `/healthz` |
| Instances | 1 |
| DATA_DIR | `./data` (optional; this is also the default) |

Create a separate Render service for Christmas so the turkey game keeps its deployment. Changing the existing service's source branch would replace that service's live edition. No Christmas service has been provisioned by this source change.

Completed scores use the instance's local filesystem. A restart, redeploy, or host replacement can clear them; an active round always aborts. For durable scores later, point DATA_DIR to a genuinely persistent directory and back up `scores.json` between events. One Node process must own that directory.

The gallery is password-free and has round controls. Use the host/network access arrangement appropriate for the event. Scanners connect automatically using ws or wss to their page's host.

## Source edition

[Christmas branch](https://github.com/Emerald-Cross/OITTURKEYGAME/tree/christmas). The separate branch is ready to copy into an independent repository named OITCHRISTMASGAME; see [FORK.md](../FORK.md). Do not merge it into turkey main unless replacing that edition is intentional.
