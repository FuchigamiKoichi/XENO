const { Game } = require('./public/src/game.js');
const { Player } = require('./public/src/player.js');
const { selectBestChoice } = require('./select.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

// ===== 設定定数 =====
const CONFIG = {
  PORT: 3000,
  DATA_FILE: './data.json',
  MAX_PLAYERS_PER_ROOM: 2,
  SOCKET_TIMEOUT: 5 * 60000, // 5分
  GAME_RULES: {
    CARDS: {
      HERO: 10,
      MIN_CARD: 1,
      MAX_CARD: 10
    },
    CHOICE_TYPES: {
      PLAY_CARD: 'play_card',
      OPPONENT_CHOICE: 'opponentChoice',
      PREDICTION: 'pred',
      TRASH: 'trush',
      UPDATE: 'update'
    },
    RESTRICTIONS: {
      HERO_UNPLAYABLE: 'カード10（英雄）は通常のプレイでは選択できません'
    }
  },
  LOG_LEVELS: {
    ERROR: 'ERROR',
    WARN: 'WARN', 
    INFO: 'INFO',
    DEBUG: 'DEBUG'
  }
};

// ===== ログとエラーハンドリング統一クラス =====
class Logger {
  /**
   * ログメッセージを出力する
   * @param {string} level - ログレベル (ERROR, WARN, INFO, DEBUG)
   * @param {string} message - ログメッセージ
   * @param {Object} data - 追加データ（オプション）
   */
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    switch (level) {
      case CONFIG.LOG_LEVELS.ERROR:
        console.error(logMessage, data ? data : '');
        break;
      case CONFIG.LOG_LEVELS.WARN:
        console.warn(logMessage, data ? data : '');
        break;
      case CONFIG.LOG_LEVELS.INFO:
        console.log(logMessage, data ? data : '');
        break;
      case CONFIG.LOG_LEVELS.DEBUG:
        console.log(logMessage, data ? data : '');
        break;
      default:
        console.log(logMessage, data ? data : '');
    }
  }

  /**
   * エラーログ出力の簡易メソッド
   * @param {string} message - エラーメッセージ
   * @param {Error} error - エラーオブジェクト（オプション）
   */
  static error(message, error = null) {
    this.log(CONFIG.LOG_LEVELS.ERROR, message, error);
  }

  /**
   * 警告ログ出力の簡易メソッド
   * @param {string} message - 警告メッセージ
   * @param {Object} data - 追加データ（オプション）
   */
  static warn(message, data = null) {
    this.log(CONFIG.LOG_LEVELS.WARN, message, data);
  }

  /**
   * 情報ログ出力の簡易メソッド
   * @param {string} message - 情報メッセージ
   * @param {Object} data - 追加データ（オプション）
   */
  static info(message, data = null) {
    this.log(CONFIG.LOG_LEVELS.INFO, message, data);
  }

  /**
   * デバッグログ出力の簡易メソッド
   * @param {string} message - デバッグメッセージ
   * @param {Object} data - 追加データ（オプション）
   */
  static debug(message, data = null) {
    this.log(CONFIG.LOG_LEVELS.DEBUG, message, data);
  }
}

// ===== グローバル状態管理 =====
let jsonData = { rooms: {}, players: {}, logs: [] };
let activeGames = {};
let pendingChoices = {}; 

// ===== データ管理クラス =====
class DataManager {
  /**
   * JSONファイルからデータを読み込み
   * ファイルが存在しない場合は初期データを使用
   */
  static loadData() {
    try {
      if (fs.existsSync(CONFIG.DATA_FILE)) {
        const raw = fs.readFileSync(CONFIG.DATA_FILE);
        jsonData = JSON.parse(raw);
        Logger.debug('データファイルを正常に読み込みました');
      } else {
        Logger.warn('データファイルが存在しないため、初期データを使用します');
      }
    } catch (error) {
      Logger.error('データ読み込みエラー', error);
      jsonData = { rooms: {}, players: {}, logs: [] };
    }
  }

  /**
   * データをJSONファイルに保存
   * @param {Object} data - 保存するデータ（デフォルト: jsonData）
   * @throws {Error} ファイル保存に失敗した場合
   */
  static saveData(data = jsonData) {
    try {
      fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2));
      Logger.debug('データファイルを正常に保存しました');
    } catch (error) {
      Logger.error('データ保存エラー', error);
      throw error;
    }
  }

  /**
   * プレイヤーを追加
   * @param {Object} playerData - プレイヤーデータ
   */
  static addPlayer(playerData) {
    this.loadData();
    if (!jsonData.players[playerData.id]) {
      jsonData.players[playerData.id] = { 
        name: playerData.name, 
        socketId: playerData.id, 
        ready: playerData.ready 
      };
      this.saveData();
    }
  }

  /**
   * 全プレイヤー情報を取得
   * @returns {Object} プレイヤー情報
   */
  static getPlayers() {
    this.loadData();
    return jsonData.players;
  }

  /**
   * プレイヤーのSocketIDを更新
   * @param {Object} playerData - プレイヤーデータ
   */
  static updateSocketId(playerData) {
    this.loadData();
    if (jsonData.players[playerData.id]) {
      jsonData.players[playerData.id].socketId = playerData.socketid;
      this.saveData();
    }
  }

  /**
   * プレイヤーを削除
   * @param {string} playerId - プレイヤーID
   */
  static removePlayer(playerId) {
    this.loadData();
    if (jsonData.players[playerId]) {
      delete jsonData.players[playerId];
      this.saveData();
    }
  }

  /**
   * 全ルームから重複プレイヤーを削除するクリーンアップ処理
   * サーバー起動時やメンテナンス時に実行される
   * @returns {void}
   */
  static cleanupDuplicatePlayers() {
    DataManager.loadData();
    let hasChanges = false;
    
    for (const roomId in jsonData.rooms) {
      const room = jsonData.rooms[roomId];
      const originalLength = room.players.length;
      
      // Set型を使用して重複を除去
      const uniquePlayers = [...new Set(room.players)];
      
      if (uniquePlayers.length !== originalLength) {
        Logger.info(`ルーム ${roomId} で重複プレイヤーを発見: ${originalLength} → ${uniquePlayers.length}`);
        room.players = uniquePlayers;
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      DataManager.saveData();
      Logger.info(`重複プレイヤーのクリーンアップが完了しました`);
    } else {
      Logger.info(`重複プレイヤーは見つかりませんでした`);
    }
  }
}

// ===== ルーム管理クラス =====
class RoomManager {
  /**
   * ルームを追加
   * @param {Object} roomData - ルームデータ
   */
  static addRoom(roomData) {
    DataManager.loadData();
    if (!jsonData.rooms[roomData.id]) {
      jsonData.rooms[roomData.id] = { 
        owner: roomData.owner, 
        players: [], 
        maxPlayers: roomData.maxPlayers, 
        playing: false 
      };
      DataManager.saveData();
    }
  }

  /**
   * 全ルーム情報を取得
   * @returns {Object} ルーム情報
   */
  static getRooms() {
    DataManager.loadData();
    return jsonData.rooms;
  }

  /**
   * プレイヤーをルームに重複なく追加
   * @param {string} roomId - ルームID
   * @param {string} playerId - プレイヤーID
   * @returns {boolean} 追加成功かどうか
   */
  static addPlayerToRoomUnique(roomId, playerId) {
    if (jsonData.rooms[roomId]) {
      const players = jsonData.rooms[roomId].players;
      if (!players.includes(playerId)) {
        players.push(playerId);
        Logger.info(`プレイヤー ${playerId} をルーム ${roomId} に追加しました`);
        return true;
      } else {
        Logger.debug(`プレイヤー ${playerId} は既にルーム ${roomId} に存在します`);
        return false;
      }
    }
    return false;
  }

  /**
   * プレイヤーをルームから削除
   * @param {string} roomId - ルームID
   * @param {string} playerId - プレイヤーID
   */
  static removePlayerFromRoom(roomId, playerId) {
    DataManager.loadData();
    if (jsonData.rooms[roomId]) {
      const index = jsonData.rooms[roomId].players.indexOf(playerId);
      if (index !== -1) {
        jsonData.rooms[roomId].players.splice(index, 1);
        DataManager.saveData();
      }
    }
  }

}

// ===== レガシー関数（後方互換性のため残存） =====
/**
 * プレイヤーをルームに追加（レガシー関数）
 * @deprecated RoomManager.addPlayerToRoomUnique() を使用してください
 * @param {Object} addData - 追加データ {roomId, playerId}
 */
function addPlayerToRoom(addData) {
  DataManager.loadData();
  if (RoomManager.addPlayerToRoomUnique(addData.roomId, addData.playerId)) {
    DataManager.saveData();
  }
}

/**
 * プレイヤーをルームから削除（レガシー関数）
 * @deprecated RoomManager.removePlayerFromRoom() を使用してください
 * @param {Object} removeData - 削除データ {roomId, playerId}
 */
function removePlayerToRoom(removeData) {
  RoomManager.removePlayerFromRoom(removeData.roomId, removeData.playerId);
}

/**
 * プレイヤーを削除（レガシー関数）
 * @deprecated DataManager.removePlayer() を使用してください
 * @param {string} name - プレイヤー名
 */
function removePlayer(name) {
  DataManager.removePlayer(name);
}

function logMatch(room, winner) {
  DataManager.loadData();
  if (!jsonData.matchLogs) jsonData.matchLogs = [];
  jsonData.matchLogs.push({
    room,
    winner,
    timestamp: new Date().toISOString(),
  });
  if (jsonData.players[winner]) {
    if (!jsonData.players[winner].wins) jsonData.players[winner].wins = 0;
    jsonData.players[winner].wins++;
  }
  DataManager.saveData();
}

// ===== サーバー初期化 =====
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 静的ファイルの配信
app.use(express.static('public'));

// レガシー変数（互換性のため残存）
let roomTimers = {};
let players = {};
let rooms = {};
let ready = 0;

io.on('connection', (socket) => {
  console.log('ユーザが接続しました:', socket.id);

  // ルームを確認する
  socket.on('showRooms', (data, callback) => {
    players = DataManager.getPlayers();
    const roomsData = RoomManager.getRooms();
    rooms = {};
    
    console.log(`利用可能ルーム確認: ${Object.keys(roomsData).length}ルーム`);
    
    // プレイ中でないルームのみを表示
    for (const key of Object.keys(roomsData)) {
      if (!roomsData[key].playing) {
        rooms[key] = roomsData[key];
      }
    }
    
    if (callback) {
      callback({ rooms, players });
    }
  });

  // socketidを変更する
  socket.on('changeSocketid', (data) => {
    DataManager.loadData();

    if (jsonData.players[data.id]) {
      const playerData = { id: data.id, socketid: socket.id };
      DataManager.updateSocketId(playerData);
      socket.join(data.roomId);
      
      console.log(`SocketID更新: ${jsonData.players[data.id].name} → ${socket.id}`);

      const room = jsonData.rooms[data.roomId];
      if (room) {
        const currentPlayers = room.players;
        console.log(`[待機チェック] ルーム ${data.roomId}: ${currentPlayers.length}人, playing: ${room.playing}, ready: ${jsonData.players[data.id].ready}`);

        // ゲーム中でない場合のみ待機処理を行う
        if (!room.playing) {
          if (currentPlayers.length === 1) {
            socket.emit('waitingForOpponent', { roomId: data.roomId });
            console.log(`--> 待機画面表示`);
          } else if (currentPlayers.length === 2) {
            io.to(data.roomId).emit('hideWaitingInfo');
            console.log(`--> 待機画面非表示`);
          }
        } else {
          console.log(`--> ゲーム中のため待機処理をスキップ`);
        }
      }
    }
  });

  // プレイヤーを登録する
  socket.on('registPlayer', (data) => {
    const playerData = { id: socket.id, name: data.name, ready: 0 };
    DataManager.addPlayer(playerData);
    Logger.info(`プレイヤー登録: ${playerData.name}`);
  });

  // ルームを作成する
  socket.on('createRoom', (data, callback) => {
    const roomId = generateRoomId();
    const roomData = {
      id: roomId, 
      owner: socket.id, 
      players: [socket.id], 
      maxPlayers: CONFIG.MAX_PLAYERS_PER_ROOM, 
      playing: false
    };
    
    RoomManager.addRoom(roomData);
    
    DataManager.loadData();
    const playerName = jsonData.players[socket.id]?.name || 'Unknown';
    Logger.info(`ルーム作成: ${roomId}, オーナー: ${playerName}`);
    
    if (callback) {
      callback({ roomId });
    }
  });

  // 既存ルームに参加する
  socket.on('joinRoom', (roomId, callback) => {
    DataManager.loadData();
    const room = jsonData.rooms[roomId];
    console.log('room')
    console.log(room)
    if (!room) {
      if (callback) callback({ success: false, message: 'ルームが存在しません。' });
      return;
    }
    if (room.players.length >= CONFIG.MAX_PLAYERS_PER_ROOM) {
      if (callback) callback({ success: false, message: 'ルームが満員です。' });
      return;
    }

    socket.join(roomId);
    
    // 重複チェックしてプレイヤーを追加
    if (RoomManager.addPlayerToRoomUnique(roomId, socket.id)) {
        DataManager.saveData();
    }
    
    const updatedRoom = jsonData.rooms[roomId];
    console.log(`ルーム参加: ${roomId} (メンバー数: ${updatedRoom.players.length}), 参加者: ${jsonData.players[socket.id].name}`);

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
    DataManager.loadData();
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
    DataManager.loadData();
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
    DataManager.loadData()
    io.to(roomId).emit('startGame',{players: jsonData.rooms[roomId].players});
  });


  /**
   * Socket.IOでクライアントに選択を求め、応答を待つ
   * @param {Object} now - 現在のゲーム状態
   * @param {Array|Object} choices - 選択肢
   * @param {string} kind - 選択の種類
   * @param {string} socketId - 対象ソケットID
   * @returns {Promise} プレイヤーの選択結果
   */
  function emitWithAck(now, choices, kind, socketId) {
    return new Promise((resolve, reject) => {
      Logger.debug(`socketId: ${socketId}`)
      Logger.debug(`kind: ${kind}`)
      const util = require('util');
      Logger.debug('Choices:', util.inspect(choices, { depth: null }));
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

  // async function choice(now, choices, kind, socketId, roomId) {
  //   try {
  //     // emitWithAckがプレイヤーの応答を待つ。
  //     // タイムアウトした場合は、emitWithAckがエラーを投げ(rejectし)、catchブロックに移行。
  //     console.log(`choice関数が呼び出されました: kind=${kind}, socketId=${socketId}`);
  //     const response = await emitWithAck(now, choices, kind, socketId, roomId);
  //     // プレイヤーが時間内に応答した場合
  //     io.to(roomId).except(socketId).emit('onatherTurn', {now: now, choices: choices, kind: kind, choice: response})
  //     console.log(`emitWithAckの結果: ${response}`);

  //     console.log(`onatherTurnイベント送信: roomId=${roomId}, kind=${kind}, choice=${response}, now=${JSON.stringify(now)}, choices=${JSON.stringify(choices)}`);
  //     return response;

  //   } catch (e) {
  //     // emitWithAckでタイムアウトエラーが発生した場合
  //     console.error("choice (yourTurn) failed:", e);
  //   }
  // }

  async function choice(now, choices, kind, socketId, roomId) {
    // Promiseでラップし、reject関数を外から呼び出せるようにする（降伏機能のため）
    return new Promise(async (resolve, reject) => {
        // 応答待ちリストに、中断用のreject関数を登録
        pendingChoices[socketId] = { reject };

        try {

            // emitWithAckがプレイヤーの応答を待つ。
            // タイムアウトした場合は、emitWithAckがエラーを投げ(rejectし)、catchブロックに移行。
            console.log(`choice関数が呼び出されました: kind=${kind}, socketId=${socketId}`);
            console.log(`choices:`, choices);
            const response = await emitWithAck(now, choices, kind, socketId, roomId);
            console.log(`emitWithAckからの応答: ${response}`);
            
            // フォールバック処理: responseが無効な値の場合
            let finalChoice;
            if (response === null || response === undefined) {
              console.log(`応答がnull/undefined: ${response}`);
              finalChoice = getFallbackChoice(choices, `null or undefined player response`, kind);
            } else if (!isValidChoice(response, choices, kind)) {
              console.log(`応答が無効: ${response}, kind: ${kind}`);
              console.log(`isValidChoice結果: ${isValidChoice(response, choices, kind)}`);
              finalChoice = getFallbackChoice(choices, `invalid player response: ${response}`, kind);
            } else {
              console.log(`応答が有効: ${response}`);
              finalChoice = response;
            }
            
            console.log(`最終選択: ${finalChoice}`);

            // プレイヤーが時間内に応答した場合
            io.to(roomId).except(socketId).emit('onatherTurn', {now: now, choices: choices, kind: kind, choice: finalChoice});
            console.log(`emitWithAckの結果: ${finalChoice}`);

            console.log(`onatherTurnイベント送信: roomId=${roomId}, kind=${kind}, choice=${finalChoice}, now=${JSON.stringify(now)}, choices=${JSON.stringify(choices)}`);
            resolve(finalChoice); // Promiseを成功として解決

        } catch (e) {
            Logger.error("choice (yourTurn) failed:", e);
            
            // 降伏によるエラーかチェック
            if (e.message === 'Player surrendered') {
                console.log("プレイヤーが降伏しました");
                reject(e); // 降伏の場合はそのままreject
            } else {
                // その他のエラー時のフォールバック処理
                const fallbackChoice = getFallbackChoice(choices, `choice function error: ${e.message}`, kind);
                io.to(roomId).except(socketId).emit('onatherTurn', {now: now, choices: choices, kind: kind, choice: fallbackChoice});
                resolve(fallbackChoice); // フォールバック値で解決
            }
        } finally {
            delete pendingChoices[socketId];
        }
    });
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
      Logger.error("Error in getFallbackChoice:", error);
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
   * @param {string} kind - 選択の種類
   * @returns {boolean} 選択値が有効かどうか
   */
  function isValidChoice(choice, choices, kind = null) {
    
    
    
    
    
    // 基本的な値チェック
    const basicValid = isBasicValueValid(choice);
    
    if (!basicValid) {
      return false;
    }
    
    // ゲームルール制約チェック
    const gameRuleValid = isChoiceAllowedByGameRules(choice, kind);
    
    if (!gameRuleValid) {
      return false;
    }
    
    // 選択肢範囲チェック
    const rangeValid = isChoiceInValidRange(choice, choices);
    
    
    
    return rangeValid;
  }

  /**
   * 基本的な値の有効性をチェック
   * @param {*} choice - チェックする選択値
   * @returns {boolean} 基本的に有効な値かどうか
   */
  function isBasicValueValid(choice) {
    return choice !== undefined && choice !== null;
  }

  /**
   * 選択肢が有効な範囲内にあるかチェック
   * @param {*} choice - チェックする選択値
   * @param {Array|Object} choices - 有効な選択肢
   * @returns {boolean} 選択肢範囲内にあるかどうか
   */
  function isChoiceInValidRange(choice, choices) {
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

  // ===== ゲームルール定数 =====
  const GAME_RULES = {
    CARDS: {
      HERO: 10,          // 英雄カード
      MIN_CARD: 1,       // 最小カード番号
      MAX_CARD: 10       // 最大カード番号
    },
    CHOICE_TYPES: {
      PLAY_CARD: 'play_card',
      OPPONENT_CHOICE: 'opponentChoice',
      PREDICTION: 'pred',
      TRASH: 'trush',
      UPDATE: 'update'
    },
    RESTRICTIONS: {
      HERO_UNPLAYABLE: 'カード10（英雄）は通常のプレイでは選択できません'
    }
  };

  /**
   * ゲームルールに基づく選択制約をチェック
   * @param {*} choice - チェックする選択値
   * @param {string} kind - 選択の種類
   * @returns {boolean} ゲームルール上有効かどうか
   */
  function isChoiceAllowedByGameRules(choice, kind) {
    const choiceNumber = parseInt(choice);
    
    // カード番号の基本チェック
    if (!isValidCardNumber(choiceNumber)) {
      return true; // カード以外の選択は基本的に制約なし
    }
    
    // 種類別制約チェック
    return checkChoiceRestrictionsByType(choiceNumber, kind);
  }

  /**
   * 有効なカード番号かどうかをチェック
   * @param {number} cardNumber - カード番号
   * @returns {boolean} 有効なカード番号かどうか
   */
  function isValidCardNumber(cardNumber) {
    return Number.isInteger(cardNumber) && 
           cardNumber >= GAME_RULES.CARDS.MIN_CARD && 
           cardNumber <= GAME_RULES.CARDS.MAX_CARD;
  }

  /**
   * 選択種類別の制約をチェック
   * @param {number} cardNumber - カード番号
   * @param {string} kind - 選択の種類
   * @returns {boolean} 制約に違反していないかどうか
   */
  function checkChoiceRestrictionsByType(cardNumber, kind) {
    switch (kind) {
      case GAME_RULES.CHOICE_TYPES.PLAY_CARD:
        return checkPlayCardRestrictions(cardNumber);
      
      case GAME_RULES.CHOICE_TYPES.PREDICTION:
      case GAME_RULES.CHOICE_TYPES.TRASH:
      case GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE:
      case GAME_RULES.CHOICE_TYPES.UPDATE:
        return true; // これらの選択では制約なし
      
      default:
        return true; // 未知の選択種類は制約なし
    }
  }

  /**
   * カードプレイ時の制約をチェック
   * @param {number} cardNumber - カード番号
   * @returns {boolean} プレイ可能かどうか
   */
  function checkPlayCardRestrictions(cardNumber) {
    if (cardNumber === GAME_RULES.CARDS.HERO) {
      console.warn(`${GAME_RULES.RESTRICTIONS.HERO_UNPLAYABLE}. Attempted card: ${cardNumber}`);
      return false;
    }
    return true;
  }

  // プレイヤーの命名関数
  /**
   * ルーム内の指定インデックスのプレイヤー名を取得
   * @param {string} roomId - ルームID
   * @param {number} index - プレイヤーのインデックス
   * @returns {string} プレイヤー名
   */
  function getName(roomId, index) {
    DataManager.loadData();
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
      Logger.error("CPU choice failed:", error);
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
    if (isValidChoice(choice, choices, kind)) {
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
    console.log(`=== Ready Event Debug ===`);
    console.log(`playerId: ${data.playerId}, roomId: ${data.roomId}`);
    
    let ready = 0;
    let funcs = []
    if (data.playerId == "cpu"){
      console.log(`CPU戦が選択されました`);
      ready = 2;
      funcs = [
          { get_name: getName, choice: choice },
          { get_name: getName_cpu, choice: choice_cpu }
      ];
    }else{
      DataManager.loadData();
      console.log(`プレイヤー戦: ${data.playerId} のready状態を1に設定`);
      jsonData.players[data.playerId].ready = 1
      DataManager.saveData();
      ready = 0
      for(let i=0; i<jsonData.rooms[data.roomId].players.length; i++){
        const currentPlayerId = jsonData.rooms[data.roomId].players[i];
        const currentReady = jsonData.players[currentPlayerId].ready;
        console.log(`プレイヤー ${currentPlayerId} のready状態: ${currentReady}`);
        ready += currentReady;
      }
      console.log(`total ready: ${ready}`);
      funcs = [
          { get_name: getName, choice: choice },
          { get_name: getName, choice: choice }
      ];
    }
    console.log(`ready合計: ${ready}, ゲーム開始判定: ${ready==2}`);
    console.log(`=== Ready Event Debug End ===`);
    
    if(ready==2){
      DataManager.loadData()
      console.log(`ゲーム開始: ルーム ${data.roomId} のplaying状態をtrueに設定`);
      jsonData.rooms[data.roomId].playing = true;
      DataManager.saveData()
      console.log('準備完了！ゲームを開始します')
      let socketIdList = []
      for(let i=0; i<jsonData.rooms[data.roomId].players.length; i++){
        socketIdList.push(jsonData.players[jsonData.rooms[data.roomId].players[i]].socketId)
      }
      const gameData = {roomId: data.roomId, players: socketIdList};
      const game = new Game(2, funcs, gameData, data.roomId);
      activeGames[data.roomId] = game; // 開始したゲームを保存
      const result = await game.game();
      delete activeGames[data.roomId]; // 終了したゲームを削除
      
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
        DataManager.saveData();
      }else{
        console.log(`err: ${result[1]}`)
        console.log(`log: ${result[2]}`)
      }
    }
  })
  socket.on('playerSurrender', (data) => {
    Logger.info('投降リクエストを受信しました', data);
    
    const { roomId, playerId } = data;
    if (!roomId || !playerId) {
      Logger.error('投降リクエストに必要なデータが不足しています', { roomId, playerId });
      return;
    }
    
    DataManager.loadData();
    if (!jsonData.rooms[roomId]) {
      Logger.error('指定されたルームが存在しません', { roomId });
      return;
    }
    if (!jsonData.players[playerId]) {
      Logger.error('指定されたプレイヤーが存在しません', { playerId });
      return;
    }
    
    const game = activeGames[roomId]; 

    const surrenderingSocketId = jsonData.players[playerId].socketId;
    if (pendingChoices[surrenderingSocketId]) {
        Logger.info(`応答待ちのchoice関数を中断させます。socketId: ${surrenderingSocketId}`);
        pendingChoices[surrenderingSocketId].reject(new Error('Player surrendered'));
    }
    
    if (game) {
        Logger.info(`ゲーム ${roomId} にforceSurrender命令を送信します。`);
        game.forceSurrender(playerId);
    } else {
        Logger.warn('アクティブなゲームが見つかりません。直接投降処理を実行します。', { roomId, activeGamesKeys: Object.keys(activeGames) });
    }

    Logger.info(`プレイヤー ${playerId} が降参しました。`);
    
    //ゲーム内部状態の更新
    jsonData.players[playerId].surrendered = true;
    Logger.debug('降参フラグを設定しました', { playerId, surrendered: jsonData.players[playerId].surrendered });
    jsonData.players[playerId].live = false;
    //即時リダイレクト処理
    const room = jsonData.rooms[roomId];
    const loserId = playerId;
    
    // CPU戦の場合の勝者特定（CPUは勝者とは見なさない）
    let winnerId = room.players.find(pId => pId !== loserId);
    
    // CPU戦の場合はwinnerId は null または undefined になるため、
    // プレイヤーのみにリダイレクトを送信する
    const isCpuGame = !winnerId || room.players.length === 1;

    Logger.debug('投降処理: プレイヤー特定', { loserId, winnerId, isCpuGame, roomPlayers: room.players });

    // ready状態をリセット
    if (jsonData.players[loserId]) {
        jsonData.players[loserId].ready = 0;
        Logger.debug('敗者のready状態をリセット', { loserId });
    }
    if (winnerId && jsonData.players[winnerId]) {
        jsonData.players[winnerId].ready = 0;
        Logger.debug('勝者のready状態をリセット', { winnerId });
    }
    DataManager.saveData();

    //敗者にリダイレクト
    const loserSocketId = jsonData.players[loserId].socketId;
    if (loserSocketId) {
        const reason = encodeURIComponent('あなたが降参しました。');
        const url = `result.html?result=lose&reason=${reason}&roomId=${roomId}&playerId=${loserId}`;
        Logger.info('敗者にリダイレクト送信', { loserSocketId, url });
        io.to(loserSocketId).emit('redirectToResult', { url: url });
    } else {
        Logger.warn('敗者のSocketIDが見つかりません', { loserId });
    }

    //勝者にリダイレクト（CPU戦の場合はスキップ）
    if (winnerId && !isCpuGame) {
        const winnerSocketId = jsonData.players[winnerId].socketId;
        if (winnerSocketId) {
            const reason = encodeURIComponent('相手が降参しました。');
            const url = `result.html?result=win&reason=${reason}&roomId=${roomId}&playerId=${winnerId}`;
            Logger.info('勝者にリダイレクト送信', { winnerSocketId, url });
            io.to(winnerSocketId).emit('redirectToResult', { url: url });
        } else {
            Logger.warn('勝者のSocketIDが見つかりません', { winnerId });
        }
    } else if (isCpuGame) {
        Logger.info('CPU戦のため、勝者へのリダイレクトをスキップします', { roomId });
    } else {
        Logger.warn('勝者が特定できませんでした', { roomId, players: room.players });
    }
    
    // アクティブゲームから削除
    if (activeGames[roomId]) {
        delete activeGames[roomId];
        Logger.info('投降により、アクティブゲームを削除しました', { roomId });
    }
    
    // ルームのplaying状態をfalseに変更
    jsonData.rooms[roomId].playing = false;
    DataManager.saveData();
    Logger.info('投降処理が完了しました', { roomId, playerId });
});

    // result.htmlにいるクライアントをルームに参加させる
    socket.on('identifyResultPage', (data) => {
        const { roomId, playerId } = data;
        if (roomId && playerId) {
            console.log(`リザルトページのクライアント ${playerId} をルーム ${roomId} に参加させます。`);
            socket.join(roomId);
        }
    });

    socket.on('requestRematch', (data) => {
      DataManager.loadData()
      jsonData.rooms[data.roomId].playing = false;
      
      const { roomId, playerId } = data;
      
      // データが正常に送られてきたか確認
      if (!roomId || !playerId) {
        Logger.error('無効な再戦リクエストを受け取りました。');
        return;
      }

      console.log(`${playerId} からルーム ${roomId} への再戦リクエストを受け取りました。`);
      const room = jsonData.rooms[roomId];

      if (room.players.length >= CONFIG.MAX_PLAYERS_PER_ROOM) {
          console.log(`ルーム ${roomId} の初回再戦リクエスト。プレイヤーリストとready状態をリセットします。`);
          
          // 既存プレイヤーのready状態をリセット
          for (const existingPlayerId of room.players) {
            if (jsonData.players[existingPlayerId]) {
              jsonData.players[existingPlayerId].ready = 0;
              console.log(`プレイヤー ${existingPlayerId} のready状態をリセット`);
            }
          }
          
          room.players = []; // ここで部屋を空にする
      }
      
      // 現在のプレイヤーのready状態もリセット
      if (jsonData.players[playerId]) {
        jsonData.players[playerId].ready = 0;
        console.log(`再戦リクエストプレイヤー ${playerId} のready状態をリセット`);
      }
      
      // 重複チェックしてプレイヤーを追加
      RoomManager.addPlayerToRoomUnique(roomId, playerId);
      console.log(`ルーム ${roomId} に ${playerId} が参加。現在のメンバー:`, room.players)

      // このプレイヤーのsocket.idを最新のものに更新し、再度ルームに参加させる
      // (game.htmlに遷移した後、changeSocketidが呼ばれるので、ここでのjoinは必須ではないが一応行う)
      socket.join(roomId);
      if (jsonData.players[playerId]) {
          console.log(`プレイヤー ${playerId} の socketId を更新: ${socket.id}`);
          jsonData.players[playerId].socketId = socket.id;
      }
      
      // 変更を保存
      DataManager.saveData();
      
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
    DataManager.loadData();
    const room = jsonData.rooms[roomId];
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
    Logger.info('ユーザが切断しました:', socket.id);

  });
});

/**
 * ランダムなルームIDを生成
 * @returns {string} 生成されたルームID（'room-'プレフィックス付き）
 */
function generateRoomId() {
  return 'room-' + Math.random().toString(36).substr(2, 9);
}

server.listen(CONFIG.PORT, () => {
  Logger.info(`サーバがポート ${CONFIG.PORT} で起動しました`);
  
  // サーバー起動時に重複プレイヤーをクリーンアップ
  Logger.info('重複プレイヤーのクリーンアップを実行中...');
  DataManager.cleanupDuplicatePlayers();
});
