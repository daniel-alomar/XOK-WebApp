import test from 'node:test';
import assert from 'node:assert/strict';
import {generateBoardCells, INITIAL_SUPPLY, calculateChains, compareChains,
  canPlayerMove, getSharkCaptures, getActiveMouths, chooseSharkMove} from '../src/game.js';

const reserve = () => structuredClone(INITIAL_SUPPLY);
const emptyReserve = () => Object.fromEntries(['white', 'black'].map(player =>
  [player, Object.fromEntries(Object.keys(INITIAL_SUPPLY[player]).map(type => [type, 0]))]));
const put = (board, q, r, owner, type='fish') => Object.assign(board.find(c=>c.q===q&&c.r===r), {owner,type});

test('initial board has 30 unique cells and both players can place fish', () => {
  const board=generateBoardCells();
  assert.equal(board.length,30);
  assert.equal(new Set(board.map(c=>`${c.q},${c.r}`)).size,30);
  for (const player of ['white','black']) assert.equal(canPlayerMove(player,board,reserve()),true);
});

test('an empty board does not allow a shark-only turn', () => {
  const supply=emptyReserve(); supply.white.shark_small=1;
  assert.equal(canPlayerMove('white',generateBoardCells(),supply),false);
  assert.equal(chooseSharkMove(generateBoardCells(),supply,'white'),null);
});

test('shark captures the covered fish and both mouth targets, never allies or sharks', () => {
  const board=generateBoardCells();
  put(board,-2,3,'black'); put(board,-1,3,'black'); put(board,-1,2,'black');
  const capture=()=>getSharkCaptures(board,'white',-2,3,getActiveMouths('shark_big_60',0));
  assert.equal(capture().length,3);
  put(board,-1,3,'white'); put(board,-1,2,'black','shark_small');
  assert.equal(capture().length,1);
  put(board,-2,3,'white'); assert.equal(capture().length,0);
  put(board,-2,3,'black','shark_small'); assert.equal(capture().length,0);
});

test('edge cells ignore mouths that point outside the board', () => {
  const board=generateBoardCells(); put(board,-1,0,'black');
  assert.equal(getSharkCaptures(board,'white',-1,0,[1,2]).length,1);
});

test('all available shark types and orientations agree about move availability', () => {
  for (const type of ['shark_small','shark_big_60','shark_big_120','shark_big_180']) {
    for (const cell of generateBoardCells()) {
      const board=generateBoardCells(), supply=emptyReserve();
      put(board,cell.q,cell.r,'white'); supply.black[type]=1;
      const move=chooseSharkMove(board,supply,'black');
      assert.equal(canPlayerMove('black',board,supply),true);
      assert.ok(move);
      assert.ok(getSharkCaptures(board,'black',move.q,move.r,move.mouths).length>=1);
    }
  }
});

test('AI can use a big shark when only one or two captures exist, including near an edge', () => {
  const board=generateBoardCells(), supply=emptyReserve();
  supply.black.shark_big_180=1; put(board,-1,0,'white'); put(board,0,0,'white');
  assert.equal(chooseSharkMove(board,supply,'black',3),null);
  const move=chooseSharkMove(board,supply,'black',1);
  assert.ok(move); assert.ok(move.eatenCount>=1); assert.ok(move.eatenCount<=2);
});

test('isolated empty cells do not permit a pair of fish', () => {
  const board=generateBoardCells(), supply=emptyReserve(); supply.white.fish=2;
  board.forEach(cell=>Object.assign(cell,{owner:'black',type:'shark_small'}));
  for (const [q,r] of [[-1,0],[-4,6]]) Object.assign(board.find(c=>c.q===q&&c.r===r),{owner:null,type:null});
  assert.equal(canPlayerMove('white',board,supply),false);
});

test('equal length chains are decided by sharks and absolute ties remain draws', () => {
  const board=generateBoardCells();
  put(board,-1,0,'white'); put(board,0,0,'white','shark_small');
  put(board,-4,6,'black'); put(board,-3,6,'black');
  const {maxChains}=calculateChains(board);
  assert.deepEqual(compareChains(maxChains.white,maxChains.black), {winner:'white',reason:'tie_reason_sharks'});
  assert.deepEqual(compareChains(maxChains.black,maxChains.white), {winner:'black',reason:'tie_reason_sharks'});
  assert.equal(compareChains(maxChains.white,maxChains.white).winner,'DRAW');
  assert.equal(compareChains({size:3,sharks:0},{size:2,sharks:2}).winner,'white');
});

test('among equal length components, count sharks in the strongest chain', () => {
  const board=generateBoardCells();
  put(board,-1,0,'white'); put(board,0,0,'white');
  put(board,-4,6,'white','shark_small'); put(board,-3,6,'white','shark_big_180');
  assert.deepEqual(calculateChains(board).maxChains.white,{size:2,sharks:2});
});
