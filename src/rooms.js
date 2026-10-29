// Firebase retries these callbacks if the room changes before the transaction commits.
export async function createRoomDocument(transaction, roomRef, initialState) {
  const snapshot = await transaction.get(roomRef);
  if (snapshot.exists()) throw new Error('ROOM_FULL');
  transaction.set(roomRef, initialState);
}

export async function reserveRoomSeat(transaction, roomRef, userId, name) {
  const snapshot = await transaction.get(roomRef);
  if (!snapshot.exists()) throw new Error('ROOM_MISSING');
  const room = snapshot.data();
  // Older rooms do not contain identities, so their original owner cannot be verified.
  if (!room.whiteId) throw new Error('ROOM_LEGACY');
  if (room.whiteId === userId) return 'white';
  if (room.blackId === userId) return 'black';
  if (room.blackId || room.winner) throw new Error('ROOM_FULL');
  transaction.update(roomRef, {blackId: userId, blackName: name});
  return 'black';
}

function verifyRoom(snapshot, userId, revision) {
  if (!snapshot.exists()) throw new Error('ROOM_MISSING');
  const room = snapshot.data();
  if (room.whiteId !== userId && room.blackId !== userId) throw new Error('ROOM_FORBIDDEN');
  if (room.revision !== revision) throw new Error('ROOM_STALE');
  return room;
}

export async function commitRoomMove(transaction, roomRef, userId, revision, turn, update) {
  const room = verifyRoom(await transaction.get(roomRef), userId, revision);
  if (!room.blackId || room.winner || room.turn !== turn || room[`${turn}Id`] !== userId) {
    throw new Error('ROOM_TURN');
  }
  transaction.update(roomRef, {...update, revision: revision + 1});
}

export async function restartRoom(transaction, roomRef, userId, revision, initialState) {
  const room = verifyRoom(await transaction.get(roomRef), userId, revision);
  if (!room.winner) throw new Error('ROOM_ACTIVE');
  transaction.update(roomRef, {...initialState, revision: revision + 1});
}
