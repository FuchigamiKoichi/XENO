// dataManager.js
const fs = require('fs');
const DATA_FILE = './data.json';

let data = { rooms: {}, players: {}, matchLogs: [] };

// ファイルから読み込み（起動時）
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE);
    data = JSON.parse(raw);
  }
}

// 保存処理（都度、または定期的）
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// プレイヤーの追加
function addPlayer(playerData) {
    let data = { rooms: {}, players: {}, matchLogs: [] };
    loadData();
    if (!data.players[playerData.id]) {
        data.players[playerData.id] = { name: playerData.name, socketId: playerData.id };
        saveData();
    }
}

// プレイヤーのsocketidの更新
function changeSocketId(playerData) {
    let data = { rooms: {}, players: {}, matchLogs: [] };
    loadData();
    if (data.players[playerData.id]) {
        data.players[playerData.id] = { name: playerData.name, socketId: playerData.id };
        saveData();
    }
}

// ルームの追加
function addRoom(roomData) {
    let data = { rooms: {}, players: {}, matchLogs: [] };
    loadData();
    if (!data.rooms[roomData.id]) {
        data.rooms[roomData.id] = { owner: roomData.owner, players: roomData.players };
        saveData();
    }
}

// ルームの確認
function showRooms() { 
    let data = { rooms: {}, players: {}, matchLogs: [] };
    loadData();
    let result = data.rooms;
    return result;
}

// プレイヤーのルームの入室
function addPlayerToRoom(addData){
    let data = { rooms: {}, players: {}, matchLogs: [] };
    loadData();
    if (data.rooms[addData.roomId]){
        data.rooms[addData.roomId].players.push(addData.playerId);
        saveData();
    }
}

// プレイヤーのルームの退室
function removePlayerToRoom(removeData){
    let data = { rooms: {}, players: {}, matchLogs: [] };
    loadData();
    if (data.rooms[removeData.roomId]){
        const index = data.rooms[removeData.roomId].players.indexOf(removeData.playerId);
        if (index !== -1) {
            data.rooms[removeData.roomId].players.splice(index, 1);
            saveData();
        }
    }
}

function removePlayer(name) {
    let data = { rooms: {}, players: {}, matchLogs: [] };
    loadData();
    if (data.players[name]) {
        delete data.players[name];
        saveData();
    }
}

function createRoom(name, players = []) {
    let data = { rooms: {}, players: {}, matchLogs: [] };
    loadData();
    if (!data.rooms[name]) {
        data.rooms[name] = { players, log: [] };
        saveData();
    }
}

function logMatch(room, winner) {
  data.matchLogs.push({
    room,
    winner,
    timestamp: new Date().toISOString(),
  });
  data.players[winner].wins++;
  saveData();
}

loadData();

module.exports = { addPlayer, removePlayer, addPlayerToRoom, removePlayerToRoom, addRoom, showRooms, changeSocketId, createRoom, logMatch, data};