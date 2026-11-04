import http from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { readFile } from 'node:fs/promises';
import { EventServer } from './lib/transport.mjs';
import { Game, COLORS } from './lib/game.mjs';
import { ScoreStore } from './lib/scores.mjs';
const root = dirname(fileURLToPath(import.meta.url));

export async function createRuntime({ dataDir = resolve(root, 'data'), clock = Date.now, scores: suppliedScores } = {}) {
  const scores = suppliedScores || await new ScoreStore(dataDir).init();
  const app = async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'none'");
    if (req.method !== 'GET') { res.writeHead(405); return res.end(); }
    let path;
    try { path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); return res.end(); }
    if (path === '/healthz') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ ok: true, persistence: scores.status })); }
    const aliases = ['/', '/gallery', '/scan/green', '/scan/red'];
    if (aliases.includes(path)) path = '/index.html';
    const file = resolve(root, 'public', '.' + path);
    if (!file.startsWith(resolve(root, 'public') + '/')) { res.writeHead(403); return res.end(); }
    try {
      const body = await readFile(file);
      const ext = path.split('.').at(-1);
      res.setHeader('Content-Type', ({ html:'text/html', css:'text/css', js:'text/javascript', svg:'image/svg+xml' })[ext] || 'application/octet-stream');
      res.end(body);
    } catch { res.writeHead(404); res.end('Not found'); }
  };
  const server = http.createServer(app);
  const io = new EventServer(server);
  const stations = new Map(), traces = new Map();
  const presence = () => Object.fromEntries(COLORS.map(color => {
    const peers = [...stations.values()].filter(s => s.color === color);
    return [color, { connected: peers.length, focused: peers.some(p => p.focused), armed: peers.some(p => p.armed) }];
  }));
  const snapshot = () => ({ ...game.snapshot(), presence: presence(), leaderboard: scores.board(), persistence: scores.status });
  const publish = extra => io.broadcast('state', { state: snapshot(), ...extra });
  let saving = null;
  const save = round => {
    saving = (round ? scores.add(round) : scores.save()).then(() => publish(), () => {
      console.error('Scores could not be saved. Check DATA_DIR permissions/disk space.'); publish();
    });
  };
  const game = new Game({ clock, onFinish: round => { save(round); } });
  io.use((socket, next) => {
    const { role, color } = socket.handshake.auth;
    if (role !== 'gallery' && !(role === 'station' && COLORS.includes(color))) return next(Error('Choose the gallery or a valid scanner.'));
    socket.data.role = role; socket.data.color = color; next();
  });
  io.on('connection', socket => {
    const { role, color } = socket.data;
    if (role === 'station') stations.set(socket.id, { color, focused: false, armed: false });
    // Never restore a buffered shot: reconnect always begins from an authoritative snapshot.
    socket.send('state', { state: snapshot() }); publish();
    socket.on('presence', data => {
      const station = stations.get(socket.id); if (!station) return;
      station.focused = data?.focused === true; station.armed = data?.armed === true; publish();
    });
    socket.on('name', (data, ack = () => {}) => {
      try { if (role !== 'station') throw Error('Scanner page required.'); game.name(color, data?.name); publish(); ack({ ok: true }); }
      catch (error) { if (typeof ack === 'function') ack({ error: error.message }); }
    });
    socket.on('control', (data, ack = () => {}) => {
      try {
        if (role !== 'gallery') throw Error('Use the gallery controls.');
        switch (data?.action) {
          case 'start': game.configure(data); game.start(); break;
          case 'finish': game.finish('Ended by staff'); break;
          case 'reset': if (scores.status !== 'saved') throw Error('Wait for scores to save before preparing the next group.'); game.reset(); break;
          case 'retrySave': if (scores.status === 'error') save(); break;
          default: throw Error('Unknown control.');
        }
        publish(); if (typeof ack === 'function') ack({ ok: true });
      } catch (error) { if (typeof ack === 'function') ack({ error: error.message }); }
    });
    socket.on('scan', (data, ack = () => {}) => {
      const receivedMono = performance.now();
      if (role !== 'station') { if (typeof ack === 'function') ack({ accepted: false, reason: 'Scanner page required.' }); return; }
      const before = game.version;
      const result = game.scan(color, data);
      const serverProcessMs = performance.now() - receivedMono;
      if (result.accepted && !result.duplicate) {
        const traceId = `${game.roundId}:${color}:${data.eventId}`;
        traces.set(traceId, receivedMono);
        publish({ hit: { ...result, traceId, serverProcessMs } });
      } else if (game.version !== before) publish();
      if (typeof ack === 'function') ack({ ...result, serverProcessMs });
    });
    socket.on('display:frame', data => {
      if (role !== 'gallery' || !data || typeof data.traceId !== 'string') return;
      const started = traces.get(data.traceId); if (started === undefined) return;
      // This is a server round trip through a browser frame callback, NOT physical TV latency.
      const metric = { traceId: data.traceId, serverToFrameReturnMs: performance.now() - started,
        domMs: Number(data.domMs), frameWaitMs: Number(data.frameWaitMs) };
      if (![metric.domMs, metric.frameWaitMs].every(n => Number.isFinite(n) && n >= 0 && n < 60000)) return;
      socket.send('diagnostic', metric);
      traces.delete(data.traceId);
    });
    socket.on('disconnect', () => { stations.delete(socket.id); publish(); });
  });
  const timer = setInterval(() => {
    if (game.tick()) publish();
    for (const [key, at] of traces) if (performance.now() - at > 10000) traces.delete(key);
  }, 50);
  const retry = setInterval(() => { if (scores.status === 'error') save(); }, 5000);
  return { app, io, server, game, scores, snapshot,
    listen: (port = 3000, host = '0.0.0.0') => new Promise(resolve => server.listen(port, host, () => resolve(server.address()))),
    close: async () => { clearInterval(timer); clearInterval(retry); io.close(); await new Promise(resolve => server.close(resolve)); await saving; await scores.pending.catch(() => {}); }
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.RENDER && !process.env.DATA_DIR) throw Error('Set DATA_DIR to a mounted persistent disk before deploying.');
  const runtime = await createRuntime({ dataDir: process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : undefined });
  await runtime.listen(Number(process.env.PORT || 3000));
  console.log(`OIT Turkey Shoot: http://localhost:${process.env.PORT || 3000}/gallery`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await runtime.close(); process.exit(runtime.scores.status === 'error' ? 1 : 0); });
}
