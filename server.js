const { Game } = require('./public/src/game.js');
const { Player } = require('./public/src/player.js');
// import { selectBestChoice } from "./select.js";
const { selectBestChoice } = require('./select.js');

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

// プレイヤー情報の取得
function showPlayers(playerData) {
  loadData();
  return jsonData.players
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
        jsonData.rooms[roomData.id] = { owner: roomData.owner, players: [], maxPlayers: roomData.maxPlayers };
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
const max_player_number = 2;


io.on('connection', (socket) => {
  console.log('ユーザが接続しました:', socket.id);

  // ルームを確認する
  socket.on('showRooms', (data, callback) => {
    players = showPlayers();
    roomsData = showRooms();
    rooms = {};
    console.log(`roomsKeys: ${Object.keys(roomsData)}`)
    for (key of Object.keys(roomsData)){
      if (roomsData[key].players.length < roomsData[key].maxPlayers){
        rooms[key] = roomsData[key];
      }
    }
    if (callback) {
        callback({ rooms, players });
    }
  });

  // socketidを変更する
  socket.on('changeSocketid', (data) => {
    loadData()

    if (jsonData.players[data.id]) {
        let playerData = {id: data.id, socketid: socket.id};
        changeSocketId(playerData);
        socket.join(data.roomId);
        console.log(`ユーザーのsocketidを変更しました: ${jsonData.players[data.id].name}, new: ${socket.id}`);

        const room = jsonData.rooms[data.roomId];
        if (room) {
            const currentPlayers = room.players;
            console.log(`[待機チェック] ルーム ${data.roomId} の現在人数: ${currentPlayers.length}人`);

            // オーナーが待機中
            if (currentPlayers.length === 1) {
                // 参加者本人にだけ「待機せよ」というイベントを送る
                socket.emit('waitingForOpponent', { roomId: data.roomId });
                console.log(`--> 'waitingForOpponent' を送信しました`);
            }
            //参加者が2人になったら
            else if (currentPlayers.length === 2) {
                // ルームにいる全員に「待機表示を消せ」というイベントを送る
                io.to(data.roomId).emit('hideWaitingInfo');
                console.log(`--> 'hideWaitingInfo' を送信しました`);
            }
        }

    } 
    // let playerData = {id: data.id, name: jsonData.players[data.id], socketid: socket.id}
    // console.log(`ユーザーのsocketidを変更しました: ${jsonData.players[data.id].name}, new: ${playerData.socketid}`)
    // changeSocketId(playerData)
    // socket.join(data.roomId)
  })
  //プレイヤーを登録する
  socket.on('registPlayer', (data) => {
    let playerData = {id: socket.id, name: data.name, ready: 0}
    addPlayer(playerData)
    console.log(`registPlayer:${playerData.name}`)
  })

  // ルームを作成する
  socket.on('createRoom', (data, callback) => {
    
    // 任意の方法で一意の roomId を生成する（例: ソケット ID + 乱数など）
    const roomId = generateRoomId();
    let roomData = {id: roomId, owner: socket.id, players: [socket.id], maxPlayers: max_player_number}
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
    console.log('room')
    console.log(room)
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

  // プレイヤーの選択関数
  async function choice(now, choices, kind, socketId, roomId) {
    try {
      console.log(`choice関数が呼び出されました: kind=${kind}, socketId=${socketId}`);
      const response = await emitWithAck(now, choices, kind, socketId, roomId);
      io.to(roomId).except(socketId).emit('onatherTurn', {now: now, choices: choices, kind: kind, choice: response});
      console.log(`emitWithAckの結果: ${response}`);

      // ログを追加して送信データを確認
      console.log(`onatherTurnイベント送信: roomId=${roomId}, kind=${kind}, choice=${response}, now=${JSON.stringify(now)}, choices=${JSON.stringify(choices)}`);
      return response;
    } catch (e) {
      console.error("choice (yourTurn) failed:", e);
    }
  }

  // プレイヤーの命名関数
  function getName(roomId, index) {
    loadData();
    return `${jsonData.players[jsonData.rooms[roomId].players[index]].name}`;
  }

  // CPUの選択関数
  async function choice_cpu(now, choices, kind, socketId, roomId) {
    try {
      const best = await selectBestChoice(choices, now, kind); // model.js の score を自動使用
      io.to(roomId).emit('onatherTurn', {now: now, choices: choices, kind: kind, choice: best})
      console.log(`kind: ${kind}`)
      console.log(`choices: ${choices}`)
      console.log("best:", best);
      return best
    } catch (e) {
      console.error("choice (yourTurn) failed:", e);
    }
  }

  // CPUの命名関数
  function getName_cpu(roomId, index) {
    return `cpu_${index}`;
  }

  // 全てのプレイヤーのreadyを判定
  socket.on("ready", async (data) => {
    let ready = 0;
    let funcs = []
    if (data.playerId == "cpu"){
      ready = 2;
      funcs = [
          { get_name: getName, choice: choice },
          { get_name: getName_cpu, choice: choice_cpu }
      ];
    }else{
      loadData();
      jsonData.players[data.playerId].ready = 1
      saveData(jsonData);
      for(let i=0; i<jsonData.rooms[data.roomId].players.length; i++){
        ready += jsonData.players[jsonData.rooms[data.roomId].players[i]].ready;
      }
      console.log(`ready: ${ready}`);
      funcs = [
          { get_name: getName, choice: choice },
          { get_name: getName, choice: choice }
      ];
    }
    if(ready==2){
      loadData()
      console.log('準備完了！ゲームを開始します')
      let socketIdList = []
      for(let i=0; i<jsonData.rooms[data.roomId].players.length; i++){
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

  });
});

function generateRoomId() {
  return 'room-' + Math.random().toString(36).substr(2, 9);
}

server.listen(3000, () => {
  console.log('サーバがポート 3000 で起動しました');
});
