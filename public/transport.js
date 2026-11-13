// No offline send buffer. Every reconnect resynchronizes state before allowing a shot.
export function connectEvents(auth) {
  const handlers = new Map(), pending = new Map();
  let ws, attempt = 0, nextId = 0, reconnectTimer, stopped = false;
  const dispatch = (event, value) => { for (const fn of handlers.get(event) || []) fn(value); };
  const api = {
    connected: false,
    on(event, fn) { if (!handlers.has(event)) handlers.set(event, []); handlers.get(event).push(fn); return api; },
    emit(event, data, callback, timeoutMs = 3000) {
      if (ws?.readyState !== WebSocket.OPEN) { callback?.(Error('Disconnected')); return false; }
      const id = callback ? ++nextId : undefined;
      if (callback) pending.set(id, { callback, timer: setTimeout(() => { pending.delete(id); callback(Error('Acknowledgement timed out')); }, timeoutMs) });
      ws.send(JSON.stringify({ event, data, id })); return true;
    },
    timeout(ms) { return { emit: (event,data,callback) => api.emit(event,data,callback,ms), get volatile() { return this; } }; },
    get volatile() { return api; },
    disconnect() { stopped = true; clearTimeout(reconnectTimer); ws?.close(); },
  };
  function connect() {
    const query = new URLSearchParams(auth);
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/events?${query}`, 'oit-christmas-v1');
    ws.onopen = () => { api.connected = true; attempt = 0; dispatch('connect'); };
    ws.onmessage = event => {
      let packet; try { packet = JSON.parse(event.data); } catch { return; }
      if (packet.ack !== undefined) {
        const item = pending.get(packet.ack); if (!item) return;
        clearTimeout(item.timer); pending.delete(packet.ack); item.callback(null, packet.data);
      } else dispatch(packet.event, packet.data);
    };
    ws.onerror = () => dispatch('connect_error', Error('WebSocket unavailable'));
    ws.onclose = () => {
      api.connected = false; dispatch('disconnect');
      for (const item of pending.values()) { clearTimeout(item.timer); item.callback(Error('Disconnected before confirmation')); } pending.clear();
      if (!stopped) reconnectTimer = setTimeout(connect, Math.min(4000, 300 * 2 ** attempt++));
    };
  }
  // Defer until the page has registered its event handlers.
  queueMicrotask(connect); return api;
}

