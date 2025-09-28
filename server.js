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

let roomTimers = {}; // { roomId: timerId, ... }

// 静的ファイルの配信（public フォルダを用意する想定）
app.use(express.static('public'));

// プレイヤー情報を管理するためのオブジェクト
let players = {};
// ルーム情報を管理するためのオブジェクト（簡易実装）
let rooms = {};
const max_player_number = 2;
let ready = 0;

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
      io.timeout(5 * 60000).to(socketId).emit('yourTurn', {now: now, choices: choices, kind: kind}, (err, responses) => {
        if (err) {
          // タイムアウトが発生した瞬間に、そのプレイヤーがまだ接続しているかを確認
          const targetSocket = io.sockets.sockets.get(socketId);
          if (!targetSocket) {
            // 既に切断済みのプレイヤーに対するタイムアウトだった場合
            console.log(`既に切断済みのソケット (${socketId}) に対するタイムアウトのため、エラー処理をスキップ。`);
            // rejectせずに、nullを返すことで、game.js側で通常のタイムアウトとして処理させる
            return resolve(null); 
          }
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

  async function choice(now, choices, kind, socketId, roomId) {
    try {
      // emitWithAckがプレイヤーの応答を待つ。
      // タイムアウトした場合は、emitWithAckがエラーを投げ(rejectし)、catchブロックに移行。
      console.log(`choice関数が呼び出されました: kind=${kind}, socketId=${socketId}`);
      const response = await emitWithAck(now, choices, kind, socketId, roomId);
      
      // フォールバック処理: responseが無効な値の場合
      let finalChoice = response;
      if (!isValidChoice(finalChoice, choices)) {
        finalChoice = getFallbackChoice(choices, `invalid player response: ${response}`, kind);
      }
      
      // プレイヤーが時間内に応答した場合
      io.to(roomId).except(socketId).emit('onatherTurn', {now: now, choices: choices, kind: kind, choice: finalChoice})
      console.log(`emitWithAckの結果: ${finalChoice}`);

      console.log(`onatherTurnイベント送信: roomId=${roomId}, kind=${kind}, choice=${finalChoice}, now=${JSON.stringify(now)}, choices=${JSON.stringify(choices)}`);
      return finalChoice;

    } catch (e) {
      // emitWithAckでタイムアウトエラーが発生した場合
      console.error("choice (yourTurn) failed:", e);
      
      // エラー時のフォールバック処理
      const fallbackChoice = getFallbackChoice(choices, `choice function error: ${e.message}`, kind);
      io.to(roomId).except(socketId).emit('onatherTurn', {now: now, choices: choices, kind: kind, choice: fallbackChoice})
      return fallbackChoice;
    }
}

  /**
   * フォールバック選択処理 - 無効な選択の場合にランダムで有効な選択肢を返す
   * @param {Array|Object} choices - 選択肢の配列またはオブジェクト
   * @param {string} reason - フォールバックが必要な理由
   * @param {string|null} kind - 選択の種類 (opponentChoice等)
   * @returns {*} フォールバック選択値
   */
  function getFallbackChoice(choices, reason = "unknown", kind = null) {
    console.warn(`Using fallback choice selection. Reason: ${reason}`);
    console.log(`Choices type: ${typeof choices}, Kind: ${kind}`);
    console.log(`Choices content:`, choices);
    
    try {
      // 配列形式の選択肢の場合
      if (Array.isArray(choices) && choices.length > 0) {
        return handleArrayChoices(choices, kind);
      }
      
      // オブジェクト形式の選択肢の場合
      if (typeof choices === 'object' && choices !== null && Object.keys(choices).length > 0) {
        return handleObjectChoices(choices, kind);
      }
      
      // 有効な選択肢がない場合のデフォルト値
      console.warn("No valid choices available, using default value 0");
      return 0;
      
    } catch (error) {
      console.error("Error in getFallbackChoice:", error);
      return 0;
    }
  }

  /**
   * 配列形式の選択肢を処理
   * @param {Array} choices - 選択肢の配列
   * @param {string|null} kind - 選択の種類
   * @returns {*} 選択値
   */
  function handleArrayChoices(choices, kind) {
    const randomIndex = Math.floor(Math.random() * choices.length);
    const selectedChoice = choices[randomIndex];
    
    // opponentChoiceの場合は特別な処理
    if (isOpponentChoice(kind, selectedChoice)) {
      const playerValue = selectedChoice.player;
      console.log(`OpponentChoice fallback: selected index ${randomIndex}, player: ${playerValue}`);
      return playerValue;
    }
    
    return selectedChoice;
  }

  /**
   * オブジェクト形式の選択肢を処理
   * @param {Object} choices - 選択肢のオブジェクト
   * @param {string|null} kind - 選択の種類
   * @returns {*} 選択値
   */
  function handleObjectChoices(choices, kind) {
    const keys = Object.keys(choices);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    const selectedChoice = choices[randomKey];
    
    // opponentChoiceの場合は特別な処理
    if (isOpponentChoice(kind, selectedChoice)) {
      const playerValue = selectedChoice.player;
      console.log(`OpponentChoice fallback: selected key ${randomKey}, player: ${playerValue}`);
      return playerValue;
    }
    
    return randomKey;
  }

  /**
   * opponentChoice形式かどうかを判定
   * @param {string|null} kind - 選択の種類
   * @param {*} choice - 選択肢
   * @returns {boolean} opponentChoice形式かどうか
   */
  function isOpponentChoice(kind, choice) {
    return kind === 'opponentChoice' && 
           typeof choice === 'object' && 
           choice !== null && 
           choice.player !== undefined;
  }

  /**
   * 選択値の有効性をチェック
   * @param {*} choice - チェックする選択値
   * @param {Array|Object} choices - 有効な選択肢
   * @returns {boolean} 選択値が有効かどうか
   */
  function isValidChoice(choice, choices) {
    // null/undefinedチェック
    if (choice === undefined || choice === null) {
      return false;
    }
    
    // 配列形式の選択肢の場合
    if (Array.isArray(choices)) {
      return choices.includes(choice);
    }
    
    // オブジェクト形式の選択肢の場合
    if (typeof choices === 'object' && choices !== null) {
      return Object.keys(choices).includes(String(choice));
    }
    
    // その他の場合は有効とみなす
    return true;
  }

  // プレイヤーの命名関数
  function getName(roomId, index) {
    loadData();
    return `${jsonData.players[jsonData.rooms[roomId].players[index]].name}`;
  }

  /**
   * CPUの選択処理を実行
   * @param {Object} now - 現在のゲーム状態
   * @param {Array|Object} choices - 選択肢
   * @param {string} kind - 選択の種類
   * @param {string} socketId - ソケットID
   * @param {string} roomId - ルームID
   * @returns {Promise<*>} 選択結果
   */
  async function choice_cpu(now, choices, kind, socketId, roomId) {
    console.log(`CPU choice requested - Kind: ${kind}, Room: ${roomId}`);
    console.log(`Choices:`, choices);
    
    try {
      // ML モデルを使用して最適な選択を取得
      const bestChoice = await selectBestChoice(choices, now, kind);
      console.log(`ML model suggested choice: ${bestChoice}`);
      
      // 選択結果の検証とフォールバック処理
      const finalChoice = validateAndProcessChoice(bestChoice, choices, kind);
      
      // クライアントに結果を送信
      emitChoiceResult(roomId, socketId, now, choices, kind, finalChoice);
      
      return finalChoice;
      
    } catch (error) {
      console.error("CPU choice failed:", error);
      return handleChoiceError(error, choices, kind, roomId, socketId, now);
    }
  }

  /**
   * 選択結果を検証し、必要に応じてフォールバック処理を実行
   * @param {*} choice - 検証する選択値
   * @param {Array|Object} choices - 有効な選択肢
   * @param {string} kind - 選択の種類
   * @returns {*} 検証済みの選択値
   */
  function validateAndProcessChoice(choice, choices, kind) {
    if (isValidChoice(choice, choices)) {
      console.log(`Valid choice selected: ${choice}`);
      return choice;
    }
    
    console.warn(`Invalid choice detected: ${choice}, using fallback`);
    return getFallbackChoice(choices, `invalid CPU response: ${choice}`, kind);
  }

  /**
   * 選択結果をクライアントに送信
   * @param {string} roomId - ルームID
   * @param {string} socketId - ソケットID
   * @param {Object} now - 現在のゲーム状態
   * @param {Array|Object} choices - 選択肢
   * @param {string} kind - 選択の種類
   * @param {*} choice - 選択結果
   */
  function emitChoiceResult(roomId, socketId, now, choices, kind, choice) {
    io.to(roomId).emit('onatherTurn', {
      now: now, 
      choices: choices, 
      kind: kind, 
      choice: choice
    });
    console.log(`Choice result emitted - Final choice: ${choice}`);
  }

  /**
   * 選択処理のエラーハンドリング
   * @param {Error} error - 発生したエラー
   * @param {Array|Object} choices - 選択肢
   * @param {string} kind - 選択の種類
   * @param {string} roomId - ルームID
   * @param {string} socketId - ソケットID
   * @param {Object} now - 現在のゲーム状態
   * @returns {*} フォールバック選択結果
   */
  function handleChoiceError(error, choices, kind, roomId, socketId, now) {
    const fallbackChoice = getFallbackChoice(choices, `choice_cpu function error: ${error.message}`, kind);
    emitChoiceResult(roomId, socketId, now, choices, kind, fallbackChoice);
    return fallbackChoice;
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
          const player = game.field.players[i];
          const result = gameLog[player.turnNumber - 1][gameLog[player.turnNumber - 1].length - 1]
          let currentPlayerId = "";
          for(let j=0; j<jsonData.rooms[data.roomId].players.length; j++){
            currentPlayerId = jsonData.rooms[data.roomId].players[j];
            if (jsonData.players[currentPlayerId].socketId == player.socketId){
              jsonData.players[currentPlayerId].ready = 0;
              io.to(player.socketId).emit('gameEnded', { 
                  result: result,
                  roomId: data.roomId,
                  playerId: currentPlayerId 
              });
              break;
            }
          }

          io.to(player.socketId).emit('result', {result: result})
          io.to(player.socketId).emit('gameEnded', { 
              result: result,
              roomId: data.roomId,
              playerId: currentPlayerId 
          });
          console.log(`${player.name}: ${result}`)
        }
        // 変更を保存
        saveData(jsonData);
      }else{
        console.log(`err: ${result[1]}`)
        console.log(`log: ${result[2]}`)
      }
    }
  })

    // result.htmlにいるクライアントをルームに参加させる
    socket.on('identifyResultPage', (data) => {
        const { roomId, playerId } = data;
        if (roomId && playerId) {
            console.log(`リザルトページのクライアント ${playerId} をルーム ${roomId} に参加させます。`);
            socket.join(roomId);
        }
    });

    socket.on('requestRematch', (data) => {
        const { roomId, playerId } = data;
        
        // データが正常に送られてきたか確認
        if (!roomId || !playerId) {
            console.error('無効な再戦リクエストを受け取りました。');
            return;
        }

        console.log(`${playerId} からルーム ${roomId} への再戦リクエストを受け取りました。`);
        const room = jsonData.rooms[roomId];

        if (room.players.length >= 2) {
            console.log(`ルーム ${roomId} の初回再戦リクエスト。プレイヤーリストをリセットします。`);
            room.players = []; // ここで部屋を空にする
        }
        room.players.push(playerId);
        console.log(`ルーム ${roomId} に ${playerId} が参加。現在のメンバー:`, room.players)

        // このプレイヤーのsocket.idを最新のものに更新し、再度ルームに参加させる
        // (game.htmlに遷移した後、changeSocketidが呼ばれるので、ここでのjoinは必須ではないが一応行う)
        socket.join(roomId);
        if (jsonData.players[playerId]) {
            console.log(`プレイヤー ${playerId} の socketId を更新: ${socket.id}`);
            jsonData.players[playerId].socketId = socket.id;
            saveData(jsonData);
        }
        const playersString = room.players.join(','); 

        // リクエストを送ってきた本人以外に、ルーム内の全員に通知を送る
        socket.broadcast.to(roomId).emit('opponentRequestedRematch', { name: jsonData.players[playerId].name });
        console.log('--> ルーム内の全員に "opponentRequestedRematch" を送信しました');
        const url = `game.html?roomId=${roomId}&playerId=${playerId}&players=${playersString}`;
        
        // リクエストを送ってきた本人にだけ「ゲーム画面へ移動せよ」と指示を送る
        socket.emit('navigateToGame', { url: url });
        console.log(`${playerId} に遷移指示を送信: ${url}`);
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

  });
});

function generateRoomId() {
  return 'room-' + Math.random().toString(36).substr(2, 9);
}

server.listen(3000, () => {
  console.log('サーバがポート 3000 で起動しました');
});
