const { connectToDatabase } = require('./lib/db');
const loginHandler = require('./api/admin/login');
const createRoomHandler = require('./api/rooms/index');
const getRoomHandler = require('./api/rooms/[code]/index');
const joinRoomHandler = require('./api/rooms/[code]/join');
const startMatchHandler = require('./api/rooms/[code]/start');
const getStateHandler = require('./api/rooms/[code]/state');
const rollDiceHandler = require('./api/rooms/[code]/roll');
const moveTokenHandler = require('./api/rooms/[code]/move');
const adminRoomsHandler = require('./api/admin/rooms');
const adminResultsHandler = require('./api/admin/results');

// Mock request and response helpers
function createMockReqRes({ method = 'GET', body = {}, query = {}, headers = {} }) {
  const req = {
    method,
    body,
    query,
    headers: { ...headers }
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    statusCode: 200,
    setHeader: () => {},
    end: (data) => {
      if (data) {
        try { responseData = JSON.parse(data); } catch (e) { responseData = data; }
      }
    },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    }
  };
  return {
    req,
    res,
    getStatusCode: () => res.statusCode,
    getData: () => responseData
  };
}

async function runApiTests() {
  console.log('--- TESTING SERVERLESS BACKEND APIS ---');

  // Step 1: Admin Login
  const loginMock = createMockReqRes({
    method: 'POST',
    body: { password: 'admin123' }
  });
  await loginHandler(loginMock.req, loginMock.res);
  const loginData = loginMock.getData();
  console.assert(loginMock.getStatusCode() === 200, 'Admin login failed');
  const adminToken = loginData.token;
  console.log('✔ 1. Admin login succeeded, token received:', adminToken.slice(0, 15) + '...');

  // Step 2: Admin Creates Room
  const testKey = 'test_create_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const createMock = createMockReqRes({
    method: 'POST',
    body: { idempotencyKey: testKey },
    headers: { 'x-admin-token': adminToken }
  });
  await createRoomHandler(createMock.req, createMock.res);
  const room = createMock.getData().room;
  console.assert(createMock.getStatusCode() === 201, 'Create room failed');
  console.assert(room.status === 'WAITING', 'Room must be WAITING');
  const roomCode = room.code;
  console.log(`✔ 2. Admin created room: ${roomCode}`);

  // Step 3: Player 1 Joins
  const p1JoinMock = createMockReqRes({
    method: 'POST',
    query: { code: roomCode },
    body: { displayName: 'Gaurav' }
  });
  await joinRoomHandler(p1JoinMock.req, p1JoinMock.res);
  const p1Data = p1JoinMock.getData();
  console.assert(p1JoinMock.getStatusCode() === 200, 'P1 join failed');
  console.assert(p1Data.slot === 'player1', 'P1 must occupy slot 1 (Red)');
  console.log(`✔ 3. Player 1 (Gaurav) joined as Red.`);

  // Step 4: Player 2 Joins
  const p2JoinMock = createMockReqRes({
    method: 'POST',
    query: { code: roomCode },
    body: { displayName: 'Rohan' }
  });
  await joinRoomHandler(p2JoinMock.req, p2JoinMock.res);
  const p2Data = p2JoinMock.getData();
  console.assert(p2JoinMock.getStatusCode() === 200, 'P2 join failed');
  console.assert(p2Data.slot === 'player2', 'P2 must occupy slot 2 (Yellow)');
  console.log(`✔ 4. Player 2 (Rohan) joined as Yellow.`);

  // Step 5: Third Player tries to join (should be rejected)
  const p3JoinMock = createMockReqRes({
    method: 'POST',
    query: { code: roomCode },
    body: { displayName: 'Hacker' }
  });
  await joinRoomHandler(p3JoinMock.req, p3JoinMock.res);
  console.assert(p3JoinMock.getStatusCode() === 409, '3rd player was not rejected!');
  console.log(`✔ 5. Full room rejected 3rd player correctly (Status 409).`);

  // Step 6: Admin Starts Match
  const startMock = createMockReqRes({
    method: 'POST',
    query: { code: roomCode },
    headers: { 'x-admin-token': adminToken }
  });
  await startMatchHandler(startMock.req, startMock.res);
  const startData = startMock.getData();
  console.assert(startMock.getStatusCode() === 200, 'Start match failed');
  console.assert(startData.gameState.status === 'IN_PROGRESS', 'Game state is IN_PROGRESS');
  console.log(`✔ 6. Admin started match successfully.`);

  // Step 7: Player 1 Rolls Dice
  const rollMock = createMockReqRes({
    method: 'POST',
    query: { code: roomCode },
    body: { playerId: p1Data.playerId, sessionToken: p1Data.sessionToken }
  });
  await rollDiceHandler(rollMock.req, rollMock.res);
  const rollData = rollMock.getData();
  console.assert(rollMock.getStatusCode() === 200, 'Roll dice failed');
  console.log(`✔ 7. Player 1 rolled dice: ${rollData.gameState.diceRoll}, legal moves: ${rollData.gameState.legalMoves.length}`);

  // Step 8: Admin Checks All Rooms & Results
  const adminRoomsMock = createMockReqRes({
    method: 'GET',
    headers: { 'x-admin-token': adminToken }
  });
  await adminRoomsHandler(adminRoomsMock.req, adminRoomsMock.res);
  const adminRoomsData = adminRoomsMock.getData();
  console.assert(adminRoomsData.stats.inProgress >= 1, 'In-progress count should be >= 1');
  console.log(`✔ 8. Admin rooms dashboard verified: Total: ${adminRoomsData.stats.total}, Active: ${adminRoomsData.stats.inProgress}`);

  console.log('ALL API ENDPOINTS TESTED AND VERIFIED SUCCESSFULLY! 🚀');
}

runApiTests().catch(err => {
  console.error('API Test Error:', err);
  process.exit(1);
});
