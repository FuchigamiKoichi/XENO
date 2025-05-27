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
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// プレイヤーの追加
function addPlayer(playerData) {
    loadData();
    if (!data.players[playerData.id]) {
      console.log('jsonにプレイヤーを追加しました')
      data.players[playerData.id] = { name: playerData.name, socketId: playerData.id };
      saveData(data);
    }
}

// プレイヤーのsocketidの更新
function changeSocketId(playerData) {
    loadData();
    if (data.players[playerData.id]) {
        data.players[playerData.id] = { name: playerData.name, socketId: playerData.id };
        saveData();
    }
}

// ルームの追加
function addRoom(roomData) {
    loadData();
    if (!data.rooms[roomData.id]) {
        data.rooms[roomData.id] = { owner: roomData.owner, players: roomData.players };
        saveData(data);
    }
}

// ルームの確認
function showRooms() { 
    loadData();
    let result = data.rooms;
    return result;
}

// プレイヤーのルームの入室
function addPlayerToRoom(addData){
    loadData();
    if (data.rooms[addData.roomId]){
        data.rooms[addData.roomId].players.push(addData.playerId);
        saveData(data);
    }
}

// プレイヤーのルームの退室
function removePlayerToRoom(removeData){
    loadData();
    if (data.rooms[removeData.roomId]){
        const index = data.rooms[removeData.roomId].players.indexOf(removeData.playerId);
        if (index !== -1) {
            data.rooms[removeData.roomId].players.splice(index, 1);
            saveData(data);
        }
    }
}

function removePlayer(name) {
    loadData();
    if (data.players[name]) {
        delete data.players[name];
        saveData(data);
    }
}

function createRoom(name, players = []) {
    loadData();
    if (!data.rooms[name]) {
        data.rooms[name] = { players, log: [] };
        saveData(data);
    }
}

function logMatch(room, winner) {
  data.matchLogs.push({
    room,
    winner,
    timestamp: new Date().toISOString(),
  });
  data.players[winner].wins++;
  saveData(data);
}



// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静的ファイルの配信（public フォルダを用意する想定）
app.use(express.static('public'));

// プレイヤー情報を管理するためのオブジェクト
let players = {};
// ルーム情報を管理するためのオブジェクト（簡易実装）
let rooms = {}; 
// 例: rooms[roomId] = { 
//   id: roomId, 
//   players: [], 
//   maxPlayers: 4, 
//   ...ゲーム状態など 
// };

io.on('connection', (socket) => {
  console.log('ユーザが接続しました:', socket.id);

  //　プレイヤーを登録する
  socket.on('registPlayer', (data) => {
    let playerData = {id: socket.id, name: data.name}
    addPlayer(playerData)
    console.log(`registPlayer:${playerData.name}`)
  })

  // ルームを確認する
  socket.on('showRooms', (data, callback) => {
    console.log(`roomsKeys: ${Object.keys(rooms)}`)
    if (callback) {
        callback({ rooms });
    }
  });

  // ルームを作成する
  socket.on('createRoom', (data, callback) => {
    // 任意の方法で一意の roomId を生成する（例: ソケット ID + 乱数など）
    const roomId = generateRoomId();
    rooms[roomId] = {
      id: roomId,
      players: [],
      maxPlayers: data.maxPlayers || 4,
      // 必要に応じて追加のゲーム状態
    };

    // ソケットをそのルームにジョインさせる
    // socket.join(roomId);
    // players 配列に登録
    // rooms[roomId].players.push(socket.id);

    console.log(`ルーム作成: ${roomId}, オーナー: ${players[socket.id].name}`);
    if (callback) {
      callback({ roomId });
    }
  });

  // 既存ルームに参加する
  socket.on('joinRoom', (roomId, callback) => {
    const room = rooms[roomId];
    if (!room) {
      if (callback) callback({ success: false, message: 'ルームが存在しません。' });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      if (callback) callback({ success: false, message: 'ルームが満員です。' });
      return;
    }

    socket.join(roomId);
    room.players.push(socket.id);
    console.log(`ルーム参加: ${roomId} (メンバー数: ${room.players.length}), 参加者: ${players[socket.id].name}`);

    // 新しいメンバーが参加したことをルーム内にブロードキャスト
    io.to(roomId).emit('updateRoomMembers', {
      players: room.players,
    });

    if (callback) {
      callback({ success: true, roomId, players: room.players, playerId: `${socket.id}` });
    }
  });

  //　プレイヤー情報の更新


  // ゲーム開始を要求 (例)
  socket.on('startGame', (roomId) => {
    console.log('startGame:',roomId);
    const room = rooms[roomId];
    if (!room) return;

    // ここでゲーム開始に必要な初期化を行う
    // 例: room.gameState = { ... };
    io.to(roomId).emit('redirect','./game.html');
  });

  // ゲーム中のプレイヤー操作を受け取る例
  socket.on('playerAction', (roomId, actionData) => {
    const room = rooms[roomId];
    if (!room) return;

    // actionData を使ってゲーム状態を更新する
    // room.gameState.playerPositions[socket.id] = actionData.position; など

    // 更新結果をルーム内の全員にブロードキャスト
    io.to(roomId).emit('gameStateUpdate', {
      // 例: state: room.gameState
      playerId: socket.id,
      action: actionData,
    });
  });

  // 切断処理
  socket.on('disconnect', () => {
    console.log('ユーザが切断しました:', socket.id);

    // 参加していたルームからプレイヤーを取り除く
    for (const [roomId, room] of Object.entries(rooms)) {
      const index = room.players.indexOf(socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        // ルームメンバーにアナウンス
        io.to(roomId).emit('updateRoomMembers', {
          players: room.players,
        });
      }
      // もし誰も居なくなったらルームを削除するなどのロジックを追加可能
      if (room.players.length === 0) {
        delete rooms[roomId];
      }
    }
  });
});

function generateRoomId() {
  return 'room-' + Math.random().toString(36).substr(2, 9);
}

server.listen(3000, () => {
  console.log('サーバがポート 3000 で起動しました');
});
