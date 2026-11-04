# Running and deployment

## Local event host

Use Node.js 22.9–24 on one host. `npm start` runs the committed source directly; no build or npm install is required. The TV workstation can also be the host. Set `PORT` if 3000 is occupied. Set `DATA_DIR` to a durable directory if the default `data/` is unsuitable. The server listens on 0.0.0.0.

Example optional `.env`:

```
PORT=3000
DATA_DIR=./data
```

Use the host LAN IP from both scanner workstations. All pages connect to their own host with `ws://` or `wss://` as appropriate. Do not use a second server for a scanner; it would create a separate game. Keep one process and stop it after save confirmation. Back up `scores.json` when the server is stopped. A malformed score file fails startup rather than silently erasing history.

No environment secrets or Supabase schema are needed. The old Halloween application's Supabase table is not read or modified.

## Render option

This first version uses a file-backed leaderboard. On Render it needs a **paid service with a persistent disk**, not the Free service's temporary filesystem. This is a deployment option, not a service provisioned by this project.

- Runtime: Node; one instance.
- Build command: `npm run check` (dependencies are already bundled).
- Start command: `npm start`.
- Health check: `/healthz`.
- Mount the persistent disk at `/var/data` and set `DATA_DIR=/var/data`.
- Render supplies `PORT`. Set `NODE_VERSION` to an allowed Node release if needed.
- Place an access layer in front of the password-free gallery before exposing it publicly.
- Restart/deploy only between rounds: active play is held in server memory and aborts on restart.

Startup refuses Render when DATA_DIR is omitted; setting a path is not proof that a persistent disk is mounted. Confirm the mount in Render. Completed scores survive a restart only if that directory really is durable. Free Render plus Supabase leaderboard-only persistence would be a separate follow-up implementation; it is not included.

Current platform facts checked November 4, 2026:

- [Render persistent disks](https://render.com/docs/disks): persistence is limited to the disk mount; disks require a paid service and a single instance.
- [Render Free](https://render.com/docs/free): local files are lost on restart, redeploy, or spin-down; Free services cannot attach disks.

## GitHub source

Source repository: [Emerald-Cross/OITTURKEYGAME](https://github.com/Emerald-Cross/OITTURKEYGAME).

Clone the repository, open its folder, and run the game:

```
git clone https://github.com/Emerald-Cross/OITTURKEYGAME.git
cd OITTURKEYGAME
npm start
```

Keep `vendor/`: it contains the bundled runtime. Do not commit `data/`, `.env`, or root `node_modules/`. The Halloween repository remains separate and unchanged. Hosting the game is a separate step from publishing its source on GitHub.
