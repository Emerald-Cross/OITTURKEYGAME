import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import WebSocket from '../vendor/node_modules/faye-websocket/lib/faye/websocket.js';
// Small event/ack envelope over a persistent standards-based WebSocket.
// Packaged libraries preserve the established Node event model without an install step.
export class EventServer extends EventEmitter {
  constructor(server) {
    super(); this.clients = new Set(); this.middleware = null;
    server.on('upgrade', (req, connection, head) => {
      let url;
      try { url = new URL(req.url, 'http://localhost'); }
      catch { return connection.destroy(); }
      if (url.pathname !== '/events' || !WebSocket.isWebSocket(req)) return connection.destroy();
      try { if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return connection.destroy(); }
      catch { return connection.destroy(); }
      const socket = new EventEmitter(); socket.id = randomUUID(); socket.data = {};
      socket.handshake = { auth: { role: url.searchParams.get('role'), color: url.searchParams.get('color') } };
      this.middleware?.(socket, error => { socket.authError = error; });
      if (socket.authError) return connection.destroy();
      const ws = new WebSocket(req, connection, head, ['oit-christmas-v1'], { ping: 5, maxLength: 8192 });
      socket.send = (event, data) => ws.send(JSON.stringify({ event, data }));
      socket.close = () => ws.close();
      // Network emissions use send(); EventEmitter.emit dispatches inbound events only.
      this.clients.add(socket);
      let lastPong = Date.now();
      const heartbeat = setInterval(() => {
        if (Date.now() - lastPong > 12000) { connection.destroy(); return; }
        ws.ping('alive', () => { lastPong = Date.now(); });
      }, 3000);
      ws.on('message', message => {
        try {
          if (typeof message.data !== 'string' || message.data.length > 8192) return ws.close(1009);
          const packet = JSON.parse(message.data);
          if (!['scan','control','name','presence','display:frame'].includes(packet.event)) return;
          const ack = Number.isSafeInteger(packet.id) ? value => ws.send(JSON.stringify({ ack: packet.id, data: value })) : () => {};
          socket.emit(packet.event, packet.data, ack);
        } catch { ws.close(1007); }
      });
      ws.on('close', () => { clearInterval(heartbeat); this.clients.delete(socket); socket.emit('disconnect'); });
      ws.on('error', () => {});
      ws.on('open', () => super.emit('connection', socket));
    });
  }
  use(fn) { this.middleware = fn; }
  broadcast(event, data) { for (const socket of this.clients) socket.send(event, data); }
  close(done) { for (const socket of this.clients) socket.close(); done?.(); }
}

