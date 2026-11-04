import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import { readFile } from 'node:fs/promises';
const source=(await readFile(new URL('../public/transport.js',import.meta.url),'utf8')).replace('export function connectEvents','function connectEvents')+'\nglobalThis.connectEvents = connectEvents;';
test('capture transport drops offline submissions, fails pending acknowledgements, and never replays on reconnect',()=>{
 const instances=[],timers=new Map();let timerId=0;
 class FakeSocket {static OPEN=1;constructor(){this.readyState=0;this.sent=[];instances.push(this);}send(text){this.sent.push(JSON.parse(text));}close(){this.readyState=3;this.onclose?.();}open(){this.readyState=1;this.onopen?.();}}
 const context=vm.createContext({WebSocket:FakeSocket,URLSearchParams,location:{protocol:'http:',host:'office.local:3000'},queueMicrotask:fn=>fn(),setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source,context);const api=context.connectEvents({role:'station',color:'green'});let calls=[];
 api.emit('scan',{eventId:'offline'},error=>calls.push(error.message));assert.deepEqual(calls,['Disconnected']);
 instances[0].open();api.timeout(100).volatile.emit('scan',{eventId:'original'},error=>calls.push(error.message));assert.equal(instances[0].sent.length,1);
 instances[0].close();assert.equal(calls.at(-1),'Disconnected before confirmation');
 // Only the reconnect timer remains; executing it creates a fresh connection.
 for(const fn of [...timers.values()])fn();instances[1].open();assert.equal(instances[1].sent.length,0);
 api.emit('scan',{eventId:'fresh'});assert.equal(instances[1].sent[0].data.eventId,'fresh');
 api.disconnect();
});
