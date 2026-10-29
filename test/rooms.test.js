import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomDocument,reserveRoomSeat,commitRoomMove,restartRoom} from '../src/rooms.js';

// Optimistic transaction double: retries on a competing commit, as Firestore does.
function store(initial) {
  let data=structuredClone(initial), version=0;
  return {
    get data(){return data;},
    async run(callback) {
      for (let attempt=0;attempt<10;attempt++) {
        const observed=version, read=structuredClone(data); let pending;
        const result=await callback({
          get:async()=>({exists:()=>Boolean(read),data:()=>read}),
          update:(_,patch)=>pending={...read,...patch},
          set:(_,state)=>pending=state,
        });
        if (observed!==version) continue;
        if (pending) {data=structuredClone(pending); version++;}
        return result;
      }
      throw new Error('too many conflicts');
    },
  };
}
const room=()=>({whiteId:'host',blackId:null,whiteName:'Host',turn:'white',revision:0,winner:null});

test('only one of two simultaneous guests reserves black', async()=>{
  const db=store(room());
  const results=await Promise.allSettled(['one','two'].map(id=>db.run(tx=>reserveRoomSeat(tx,'room',id,id))));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(results.find(result=>result.status==='rejected').reason.message,'ROOM_FULL');
  assert.ok(['one','two'].includes(db.data.blackId));
});

test('host and existing guest can rejoin without taking another seat', async()=>{
  const db=store({...room(),blackId:'guest',blackName:'Guest'});
  assert.equal(await db.run(tx=>reserveRoomSeat(tx,'r','host','Changed')),'white');
  assert.equal(await db.run(tx=>reserveRoomSeat(tx,'r','guest','Changed')),'black');
  assert.equal(db.data.blackName,'Guest');
  await assert.rejects(db.run(tx=>reserveRoomSeat(tx,'r','third','Third')),/ROOM_FULL/);
});

test('missing and legacy rooms cannot be claimed',async()=>{
  await assert.rejects(store(null).run(tx=>reserveRoomSeat(tx,'r','guest','G')),/ROOM_MISSING/);
  await assert.rejects(store({whiteName:'Host'}).run(tx=>reserveRoomSeat(tx,'r','guest','G')),/ROOM_LEGACY/);
});

test('room creation never overwrites an existing room',async()=>{
  const db=store(room());
  await assert.rejects(db.run(tx=>createRoomDocument(tx,'r',{})),/ROOM_FULL/);
  const empty=store(null); await empty.run(tx=>createRoomDocument(tx,'r',room()));
  assert.equal(empty.data.whiteId,'host');
});

test('moves require two players, current revision, membership and the correct turn',async()=>{
  const waiting=store(room());
  await assert.rejects(waiting.run(tx=>commitRoomMove(tx,'r','host',0,'white',{turn:'black'})),/ROOM_TURN/);
  const db=store({...room(),blackId:'guest'});
  await assert.rejects(db.run(tx=>commitRoomMove(tx,'r','third',0,'white',{})),/ROOM_FORBIDDEN/);
  await assert.rejects(db.run(tx=>commitRoomMove(tx,'r','guest',0,'white',{})),/ROOM_TURN/);
  await db.run(tx=>commitRoomMove(tx,'r','host',0,'white',{turn:'black'}));
  assert.equal(db.data.revision,1);
  await assert.rejects(db.run(tx=>commitRoomMove(tx,'r','host',0,'white',{})),/ROOM_STALE/);
});

test('concurrent submissions of the same turn commit only once',async()=>{
  const db=store({...room(),blackId:'guest'});
  const results=await Promise.allSettled([1,2].map(()=>db.run(tx=>commitRoomMove(tx,'r','host',0,'white',{turn:'black'}))));
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  assert.equal(db.data.revision,1);
});

test('finished rooms reject moves and restart preserves identities',async()=>{
  const db=store({...room(),blackId:'guest',winner:'white'});
  await assert.rejects(db.run(tx=>commitRoomMove(tx,'r','host',0,'white',{})),/ROOM_TURN/);
  await db.run(tx=>restartRoom(tx,'r','guest',0,{winner:null,turn:'white'}));
  assert.equal(db.data.whiteId,'host'); assert.equal(db.data.blackId,'guest');
  assert.equal(db.data.revision,1); assert.equal(db.data.winner,null);
  await assert.rejects(db.run(tx=>restartRoom(tx,'r','host',1,{})),/ROOM_ACTIVE/);
});
