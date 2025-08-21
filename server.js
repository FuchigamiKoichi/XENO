const { Game } = require('./public/src/game.js');
const { Player } = require('./public/src/player.js');
// const { score } = require('./model.js');

// dataManager.js
const fs = require('fs');
const DATA_FILE = './data.json';

let jsonData = { rooms: {}, players: {}, logs: [] };

// ファイルから読み込み（起動時）
function loadData() {
  if (fs.existsSync(DATA_FILE)) {
    const raw = fs.readFileSync(DATA_FILE);
    jsonData = JSON.parse(raw);
  }
}

// 保存処理（都度、または定期的）
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// プレイヤーの追加
function addPlayer(playerData) {
    loadData();
    if (!jsonData.players[playerData.id]) {
      jsonData.players[playerData.id] = { name: playerData.name, socketId: playerData.id, ready: playerData.ready };
      saveData(jsonData);
    }
}

// プレイヤーのsocketidの更新
function changeSocketId(playerData) {
    loadData();
    if (jsonData.players[playerData.id]) {
        jsonData.players[playerData.id].socketId = playerData.socketid;
        saveData(jsonData);
    }
}

// ルームの追加
function addRoom(roomData) {
    loadData();
    if (!jsonData.rooms[roomData.id]) {
        jsonData.rooms[roomData.id] = { owner: roomData.owner, players: [] };
        saveData(jsonData);
    }
}

// ルームの確認
function showRooms() { 
    loadData();
    let result = jsonData.rooms;
    return result;
}

// プレイヤーのルームの入室
function addPlayerToRoom(addData){
    loadData();
    if (jsonData.rooms[addData.roomId]){
        jsonData.rooms[addData.roomId].players.push(addData.playerId);
        saveData(jsonData);
    }
}

// プレイヤーのルームの退室
function removePlayerToRoom(removeData){
    loadData();
    if (jsonData.rooms[removeData.roomId]){
        const index = jsonData.rooms[removeData.roomId].players.indexOf(removeData.playerId);
        if (index !== -1) {
            jsonData.rooms[removeData.roomId].players.splice(index, 1);
            saveData(jsonData);
        }
    }
}

function removePlayer(name) {
    loadData();
    if (jsonData.players[name]) {
        delete jsonData.players[name];
        saveData(jsonData);
    }
}

function logMatch(room, winner) {
  jsonData.matchLogs.push({
    room,
    winner,
    timestamp: new Date().toISOString(),
  });
  jsonData.players[winner].wins++;
  saveData(jsonData);
}



// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { json } = require('stream/consumers');
const { permission } = require('process');

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
    let playerData = {id: socket.id, name: data.name, ready: 0}
    addPlayer(playerData)
    console.log(`registPlayer:${playerData.name}`)
  })

  // ルームを確認する
  socket.on('showRooms', (data, callback) => {
    rooms = showRooms();
    console.log(`roomsKeys: ${Object.keys(rooms)}`)
    if (callback) {
        callback({ rooms });
    }
  });

  // socketidを変更する
  socket.on('changeSocketid', (data) => {
    loadData()
    let playerData = {id: data.id, name: jsonData.players[data.id], socketid: socket.id}
    console.log(`ユーザーのsocketidを変更しました: ${jsonData.players[data.id].name}, new: ${playerData.socketid}`)
    changeSocketId(playerData)
    socket.join(data.roomId)
  })

  // ルームを作成する
  socket.on('createRoom', (data, callback) => {
    // 任意の方法で一意の roomId を生成する（例: ソケット ID + 乱数など）
    const roomId = generateRoomId();
    let roomData = {id: roomId, owner: socket.id, players: [socket.id]}
    addRoom(roomData)
    // ソケットをそのルームにジョインさせる
    // socket.join(roomId);
    // players 配列に登録
    // rooms[roomId].players.push(socket.id);

    console.log(`ルーム作成: ${roomId}, オーナー: ${jsonData.players[socket.id].name}`);
    if (callback) {
      callback({ roomId });
    }
  });

  // 既存ルームに参加する
  socket.on('joinRoom', (roomId, callback) => {
    loadData();
    const room = jsonData.rooms[roomId];
    if (!room) {
      if (callback) callback({ success: false, message: 'ルームが存在しません。' });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      if (callback) callback({ success: false, message: 'ルームが満員です。' });
      return;
    }

    socket.join(roomId);
    jsonData.rooms[roomId].players.push(socket.id);
    saveData(jsonData)
    console.log(`ルーム参加: ${roomId} (メンバー数: ${room.players.length}), 参加者: ${jsonData.players[socket.id].name}`);

    // 新しいメンバーが参加したことをルーム内にブロードキャスト
    io.to(roomId).emit('updateRoomMembers', {
      players: room.players,
    });

    if (callback) {
      callback({ success: true, roomId, players: room.players, playerId: `${socket.id}` });
    }
  });

  // プレイヤー情報を返す
  socket.on('getPlayerNames', (data, callback) => {
    loadData();
    let playerData = jsonData.players;
    let roomData = jsonData.rooms[data.roomId];
    let playerNames = []
    let playerPermissionClasses = []
    for(let i=0; i<data.players.length; i++){
      playerName = playerData[data.players[i]].name
      let playerPermissionClass = 'none'
      if(roomData.owner == data.players[i]){
        playerPermissionClass = 'owner'
      }else{
        playerPermissionClass = 'player'
      }
      playerNames.push(playerName)
      playerPermissionClasses.push(playerPermissionClass)
    }

    if (callback) {
      callback({ success: true, playerNames: playerNames, playerPermissionClasses: playerPermissionClasses});
    }
  });

  // プレイヤー情報を返す
  socket.on('getPermissionClass', (data, callback) => {
    loadData();
    let roomData = jsonData.rooms[data.roomId];
    let permissionClass = 'none'
    let inPlayers = 0
    
    if(roomData.owner == data.playerId){
      permissionClass = 'owner'
    }else if(roomData.players.includes(data.playerId)){
      permissionClass = 'player'
    }

    if (callback) {
      callback({ success: true, permissionClass: permissionClass});
    }
  });

  //　プレイヤー情報の更新


  // ゲーム開始を要求 (例)
  socket.on('startGame', (roomId) => {
    console.log('startGame:',roomId);

    // ここでゲーム開始に必要な初期化を行う
    // 例: room.gameState = { ... };
    loadData()
    io.to(roomId).emit('startGame',{players: jsonData.rooms[roomId].players});
  });


  function emitWithAck(now, choices, kind, socketId) {
    return new Promise((resolve, reject) => {
      console.log(`socketId: ${socketId}`)
      console.log(`kind: ${kind}`)
      const util = require('util');
      console.log(util.inspect(choices, { depth: null }));
      io.timeout(5*60000).to(socketId).emit('yourTurn', {now: now, choices: choices, kind: kind}, (err, responses) => {
        if (err) {
          reject(err);
        } else {
          if(responses && responses.length>0){
            if(kind=='opponentChoice'){
              const playerChoice = choices[responses].player
              console.log(`responses: ${responses}`)
              console.log(`playerChoice: ${playerChoice}`)
              resolve(playerChoice); // 最初の応答を返す（単一対象を想定）
            }else{
              resolve(choices[responses[0]])
            }
          }else{
            reject(new Error("No response received"));
          }
        }
      });
    });
  }

  // CPUプレイヤーの選択関数
  async function choice(now, choices, kind, socketId, roomId) {
    try {
      const response = await emitWithAck(now, choices, kind, socketId, roomId);
      io.to(roomId).except(socketId).emit('onatherTurn', {now: now, choices: choices, kind: kind, choice: response})
      console.log(`responce: ${response}`)
      return response
    } catch (e) {
      console.error("choice (yourTurn) failed:", e);
    }
  }

  // CPUプレイヤーの命名関数
  function getName(roomId, index) {
    loadData();
    return `${jsonData.players[jsonData.rooms[roomId].players[index]].name}`;
  }

  // 使用例
  const funcs = [
      { get_name: getName, choice: choice },
      { get_name: getName, choice: choice }
  ];

  // 全てのプレイヤーのreadyを判定
  socket.on("ready", async (data) => {
    loadData();
    jsonData.players[data.playerId].ready = 1
    saveData(jsonData);
    let ready = 0;
    for(let i=0; i<jsonData.rooms[data.roomId].players.length; i++){
      ready += jsonData.players[jsonData.rooms[data.roomId].players[i]].ready;
    }
    console.log(`ready: ${ready}`);
    if(ready==2){
      loadData()
      console.log('準備完了！')
      let socketIdList = []
      for(let i=0; i<2; i++){
        socketIdList.push(jsonData.players[jsonData.rooms[data.roomId].players[i]].socketId)
      }
      const gameData = {roomId: data.roomId, players: socketIdList};
      const game = new Game(2, funcs, gameData, data.roomId);
      const result = await game.game();
      if(result[0]){
        const gameLog = result[1]
        for(let i=0; i<game.field.players.length; i++){
          const player = game.field.players[i]
          const result = gameLog[i][gameLog[i].length - 1]
          io.to(player.socketId).emit('result', {result: result})
          for(let k=0; k<gameLog[i].length; k++){
            console.log(gameLog[i][k])
          }
          console.log(`${player.name}: ${result}`)
        }

      }else{
        console.log(`err: ${result[1]}`)
        console.log(`log: ${result[2]}`)
      }
    }
  })

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

    // // 参加していたルームからプレイヤーを取り除く
    // for (const [roomId, room] of Object.entries(rooms)) {
    //   const index = room.players.indexOf(socket.id);
    //   if (index !== -1) {
    //     room.players.splice(index, 1);
    //     // ルームメンバーにアナウンス
    //     io.to(roomId).emit('updateRoomMembers', {
    //       players: room.players,
    //     });
    //   }
    //   // もし誰も居なくなったらルームを削除するなどのロジックを追加可能
    //   if (room.players.length === 0) {
    //     delete rooms[roomId];
    //   }
    // }
  });
});

function generateRoomId() {
  return 'room-' + Math.random().toString(36).substr(2, 9);
}

server.listen(3000, () => {
  console.log('サーバがポート 3000 で起動しました');
});
