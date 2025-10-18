const CONFIG = require('../config/config');
const Logger = require('../utils/logger');
const DataManager = require('../managers/dataManager');
const RoomManager = require('../managers/roomManager');
const GameService = require('../services/gameService');

/*
 * Socket.IOイベント処理
 */
class SocketHandlers {
  static setupHandlers(io, activeGames, pendingChoices) {
    io.on('connection', (socket) => {
      Logger.info('ユーザ接続:', socket.id);

      // プレイヤー登録
      socket.on('registPlayer', (data) => {
        SocketHandlers.handleRegistPlayer(socket, data);
      });

      // ルーム作成
      socket.on('createRoom', (data, callback) => {
        SocketHandlers.handleCreateRoom(socket, data, callback);
      });

      // ルーム参加
      socket.on('joinRoom', (roomId, callback) => {
        SocketHandlers.handleJoinRoom(socket, roomId, callback);
      });

      // ルーム表示
      socket.on('showRooms', (data, callback) => {
        SocketHandlers.handleShowRooms(callback);
      });

      // SocketID変更
      socket.on('changeSocketid', (data) => {
        SocketHandlers.handleChangeSocketId(socket, data, io);
      });

      // プレイヤー名取得
      socket.on('getPlayerNames', (data, callback) => {
        SocketHandlers.handleGetPlayerNames(data, callback);
      });

      // 権限クラス取得
      socket.on('getPermissionClass', (data, callback) => {
        SocketHandlers.handleGetPermissionClass(data, callback);
      });

      // ゲーム状態確認
      socket.on('checkGameStatus', (data, callback) => {
        SocketHandlers.handleCheckGameStatus(data, callback);
      });

      // ゲーム開始
      socket.on('startGame', (roomId) => {
        SocketHandlers.handleStartGame(roomId, io);
      });

      // Ready状態
      socket.on('ready', async (data) => {
        await SocketHandlers.handleReady(data, io, activeGames);
      });

      // プレイヤー投降
      socket.on('playerSurrender', (data) => {
        SocketHandlers.handlePlayerSurrender(data, io, activeGames, pendingChoices);
      });

      // 再戦リクエスト
      socket.on('requestRematch', (data) => {
        SocketHandlers.handleRequestRematch(socket, data, io);
      });

      // プレイヤーアクション
      socket.on('playerAction', (roomId, actionData) => {
        SocketHandlers.handlePlayerAction(socket, roomId, actionData, io);
      });

      // リザルトページ識別
      socket.on('identifyResultPage', (data) => {
        SocketHandlers.handleIdentifyResultPage(socket, data);
      });

      // ルーム削除リクエスト（管理者用）
      socket.on('deleteRoom', (data, callback) => {
        SocketHandlers.handleDeleteRoom(socket, data, callback, io);
        // setTimeout(() => {
        //   SocketHandlers.handleDeleteRoom(socket, data, callback, io);
        // }, 60000 * 5); 
      });

      // ゲーム状態確認（リザルト遷移確認用）
      socket.on('checkGameStatus', (data, callback) => {
        SocketHandlers.handleCheckGameStatus(data, callback);
      });

      // ロビーに戻る選択
      socket.on('returnToLobby', (data) => {
        SocketHandlers.handleReturnToLobby(socket, data, io);
      });

      socket.on('disconnect', () => {
        Logger.info(`ユーザ切断: ${socket.id}`);
        
        // 切断時に適切なクリーンアップを実行
        SocketHandlers.handlePlayerDisconnect(socket.id, io);
      });
    });
  }

  static handleRegistPlayer(socket, data) {
    const playerData = { id: socket.id, name: data.name, ready: 0 };
    DataManager.addPlayer(playerData);
    Logger.info(`プレイヤー登録: ${playerData.name}, ready状態: 0で初期化`);
  }

  /**
   * ルーム作成処理
   */
  static handleCreateRoom(socket, data, callback) {
    const roomId = SocketHandlers.generateRoomId();
    const roomData = {
      id: roomId, 
      owner: socket.id, 
      players: [], // 空の配列から開始
      maxPlayers: CONFIG.MAX_PLAYERS_PER_ROOM, 
      playing: false
    };
    
    RoomManager.addRoom(roomData);
    
    // 作成者をルームに追加
    socket.join(roomId);
    if (RoomManager.addPlayerToRoomUnique(roomId, socket.id)) {
      // プレイヤーのready状態を初期化
      DataManager.loadData();
      const jsonData = DataManager.getJsonData();
      if (jsonData.players[socket.id]) {
        jsonData.players[socket.id].ready = 0;
        Logger.debug(`ルーム作成者 ${jsonData.players[socket.id].name} のready状態を0に初期化`);
      }
      DataManager.saveData();
    }
    
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    const playerName = jsonData.players[socket.id]?.name || 'Unknown';
    Logger.info(`ルーム作成: ${roomId}, オーナー: ${playerName}, プレイヤー数: ${jsonData.rooms[roomId].players.length}`);
    
    if (callback) {
      callback({ roomId });
    }
  }

  /**
   * ルーム参加処理
   */
  static handleJoinRoom(socket, roomId, callback) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    const room = jsonData.rooms[roomId];
    
    Logger.debug('room', room);
    
    if (!room) {
      if (callback) callback({ success: false, message: 'ルームが存在しません。' });
      return;
    }
    if (room.players.length >= CONFIG.MAX_PLAYERS_PER_ROOM) {
      if (callback) callback({ success: false, message: 'ルームが満員です。' });
      return;
    }

    socket.join(roomId);
    
    if (RoomManager.addPlayerToRoomUnique(roomId, socket.id)) {
        // プレイヤーのready状態を初期化
        if (jsonData.players[socket.id]) {
          jsonData.players[socket.id].ready = 0;
          Logger.debug(`プレイヤー ${jsonData.players[socket.id].name} のready状態を0に初期化`);
        }
        DataManager.saveData();
    }
    
    // ルームのアクティビティを更新
    RoomManager.updateRoomActivity(roomId);
    
    const updatedRoom = jsonData.rooms[roomId];
    Logger.info(`ルーム参加: ${roomId} (メンバー数: ${updatedRoom.players.length}), 参加者: ${jsonData.players[socket.id].name}`);

    if (callback) {
      callback({ success: true, roomId, players: room.players, playerId: `${socket.id}` });
    }
  }

  /**
   * ルーム表示処理
   */
  static handleShowRooms(callback) {
    const players = DataManager.getPlayers();
    const roomsData = RoomManager.getRooms();
    const rooms = {};
    
    Logger.info(`ルーム確認: ${Object.keys(roomsData).length}件`);
    
    for (const key of Object.keys(roomsData)) {
      if (!roomsData[key].playing) {
        rooms[key] = roomsData[key];
      }
    }
    
    if (callback) {
      callback({ rooms, players });
    }
  }

  /**
   * SocketID変更処理
   */
  static handleChangeSocketId(socket, data, io) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();

    if (jsonData.players[data.id]) {
      const playerData = { id: data.id, socketid: socket.id };
      DataManager.updateSocketId(playerData);
      
      // ready状態を初期化（ゲーム開始前の場合）
      if (jsonData.players[data.id]) {
        jsonData.players[data.id].ready = 0;
        Logger.debug(`SocketID更新時にプレイヤー ${jsonData.players[data.id].name} のready状態を0に初期化`);
      }
      
      socket.join(data.roomId);
      
      Logger.info(`SocketID更新: ${jsonData.players[data.id].name} → ${socket.id}`);

      const room = jsonData.rooms[data.roomId];
      if (room) {
        const currentPlayers = room.players;
        Logger.debug(`[待機チェック] ルーム ${data.roomId}: ${currentPlayers.length}人, playing: ${room.playing}, ready: ${jsonData.players[data.id].ready}`);

        if (!room.playing) {
          if (currentPlayers.length === 1) {
            socket.emit('waitingForOpponent', { roomId: data.roomId });
            Logger.debug(`--> 待機画面表示`);
          } else if (currentPlayers.length === 2) {
            io.to(data.roomId).emit('hideWaitingInfo');
            Logger.debug(`--> 待機画面非表示`);
          }
        } else {
          Logger.debug(`--> ゲーム中のため待機処理をスキップ`);
        }
      }
    }
  }

  /**
   * プレイヤー名取得処理
   */
  static handleGetPlayerNames(data, callback) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    let playerData = jsonData.players;
    let roomData = jsonData.rooms[data.roomId];
    let playerNames = []
    let playerPermissionClasses = []
    
    for(let i = 0; i < data.players.length; i++) {
      const playerName = playerData[data.players[i]].name;
      let playerPermissionClass = 'none';
      if(roomData.owner == data.players[i]) {
        playerPermissionClass = 'owner';
      } else {
        playerPermissionClass = 'player';
      }
      playerNames.push(playerName);
      playerPermissionClasses.push(playerPermissionClass);
    }

    if (callback) {
      callback({ success: true, playerNames: playerNames, playerPermissionClasses: playerPermissionClasses});
    }
  }

  /**
   * 権限クラス取得処理
   */
  static handleGetPermissionClass(data, callback) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    let roomData = jsonData.rooms[data.roomId];
    let permissionClass = 'none';
    
    if(roomData.owner == data.playerId) {
      permissionClass = 'owner';
    } else if(roomData.players.includes(data.playerId)) {
      permissionClass = 'player';
    }

    if (callback) {
      callback({ success: true, permissionClass: permissionClass});
    }
  }

  /**
   * ゲーム状態確認処理
   */
  static handleCheckGameStatus(data, callback) {
    Logger.debug('[checkGameStatus] クライアントからの状態確認要求:', data);
    
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (!data.roomId) {
      if (callback) callback({ success: false, message: 'roomIdが必要です' });
      return;
    }
    
    const roomData = jsonData.rooms[data.roomId];
    if (!roomData) {
      if (callback) callback({ success: false, message: 'ルームが存在しません' });
      return;
    }
    
    const response = {
      success: true,
      playing: roomData.playing,
      playerCount: roomData.players.length,
      maxPlayers: roomData.maxPlayers
    };
    
    Logger.debug('[checkGameStatus] 状態確認結果:', response);
    
    if (callback) {
      callback(response);
    }
  }

  /**
   * ゲーム開始処理
   */
  static handleStartGame(roomId, io) {
    Logger.info('startGame:', roomId);
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    io.to(roomId).emit('startGame', {players: jsonData.rooms[roomId].players});
  }

  /**
   * 結果配列を正規化して winners / losers を取得
   * result 仕様:
   *  - 正常終了: [true, gameLog, winners[], losers[]]
   *  - 早期終了等: [false, winners[], losers[]]
   */
  static normalizeGameResult(result) {
    try {
      if (Array.isArray(result) && result.length > 0 && result[0] === true) {
        return {
          winners: Array.isArray(result[2]) ? result[2] : [],
          losers: Array.isArray(result[3]) ? result[3] : [],
          ok: true,
        };
      }
      
      // 不正データの場合でも、常に配列を返すように修正
      const winners = (result && Array.isArray(result[1])) ? result[1] : [];
      const losers = (result && Array.isArray(result[2])) ? result[2] : [];
      
      return {
        winners,
        losers,
        ok: false,
      };
    } catch (error) {
      // エラーが発生した場合でも安全なデフォルトを返す
      Logger.warn('normalizeGameResult error:', error);
      return {
        winners: [],
        losers: [],
        ok: false,
      };
    }
  }

  /**
   * プレイヤーIDからプレイヤー情報を取得
   * @param {Object} jsonData - ゲームデータ
   * @param {string} playerId - プレイヤーID
   * @returns {Object|null} プレイヤー情報 { id, player }
   */
  static findPlayerById(jsonData, playerId) {
    const player = jsonData.players?.[playerId];
    if (player) {
      console.log(`[findPlayerById] 見つかりました: ${playerId} -> ${player.name} (socketId: ${player.socketId})`);
      return { id: playerId, player };
    }
    console.warn(`[findPlayerById] プレイヤーが見つかりません: ${playerId}`);
    return null;
  }

  /**
   * ゲーム内playerオブジェクトからplayerIdを取得し、data.jsonから正確な情報を取得
   * @param {Object} gamePlayer - ゲーム内のplayerオブジェクト
   * @param {Object} jsonData - data.json全体のデータ
   * @returns {Object|null} {id: playerIdString, player: playerObject} または null
   */
  static getPlayerInfoFromGame(gamePlayer, jsonData) {
    try {
      if (!gamePlayer) {
        Logger.error(`[getPlayerInfoFromGame] gamePlayerが未定義です`);
        return null;
      }
      
      // PlayerクラスのidプロパティまたはplayerIdプロパティをチェック
      const playerId = gamePlayer.id || gamePlayer.playerId;
      
      if (!playerId || typeof playerId !== 'string') {
        Logger.error(`[getPlayerInfoFromGame] 無効なplayerId:`, { 
          playerId, 
          hasId: !!gamePlayer.id, 
          hasPlayerId: !!gamePlayer.playerId,
          playerName: gamePlayer.name,
          playerType: typeof gamePlayer,
          isPlayer: gamePlayer.constructor?.name
        });
        return null;
      }
      
      Logger.debug(`[getPlayerInfoFromGame] Player情報確認: name=${gamePlayer.name}, id=${playerId}`);
      
      // data.jsonからplayerIdで検索
      if (jsonData && jsonData.players && jsonData.players[playerId]) {
        Logger.debug(`[getPlayerInfoFromGame] data.jsonから発見: playerId=${playerId}, socketId=${jsonData.players[playerId].socketId}`);
        return {
          id: playerId,
          player: jsonData.players[playerId]
        };
      }

      Logger.error(`[getPlayerInfoFromGame] data.jsonにplayerId=${playerId}が見つかりません`);
      Logger.debug(`[getPlayerInfoFromGame] data.json.players keys:`, Object.keys(jsonData.players || {}));
      return null;
    } catch (error) {
      Logger.error(`[getPlayerInfoFromGame] エラー:`, error);
      return null;
    }
  }

  /**
   * ルームのプレイヤーリストから実際のプレイヤーを特定（フォールバック用）
   * @param {Object} jsonData - ゲームデータ
   * @param {string} roomId - ルームID
   * @param {Object} gamePlayer - ゲームのPlayerオブジェクト (name, socketIdを持つ)
   * @returns {Object|null} プレイヤー情報 { id, player }
   */
  static findRoomPlayer(jsonData, roomId, gamePlayer) {
    const room = jsonData.rooms?.[roomId];
    if (!room || !room.players) {
      Logger.warn(`[findRoomPlayer] ルームまたはプレイヤーリストが見つかりません: ${roomId}`);
      // フォールバック: 全プレイヤーから名前で検索
      Logger.debug(`[findRoomPlayer] フォールバック検索を実行: ${gamePlayer.name}`);
      for (const [playerId, player] of Object.entries(jsonData.players || {})) {
        if (player && player.name === gamePlayer.name && player.socketId) {
          Logger.debug(`[findRoomPlayer] フォールバック検索で見つかりました: ${playerId} -> ${player.name} (socketId: ${player.socketId})`);
          return { id: playerId, player };
        }
      }
      Logger.warn(`[findRoomPlayer] フォールバック検索でも見つかりません: ${gamePlayer.name}`);
      return null;
    }

    // CPU プレイヤーの場合はスキップ
    if (gamePlayer.name && gamePlayer.name.startsWith('cpu_')) {
      Logger.debug(`[findRoomPlayer] CPUプレイヤーをスキップ: ${gamePlayer.name}`);
      return null;
    }

    // ルームのプレイヤーリストから該当プレイヤーを検索
    for (const playerId of room.players) {
      const player = jsonData.players?.[playerId];
      
      if (player && player.name === gamePlayer.name) {
        Logger.debug(`[findRoomPlayer] 見つかりました: ${playerId} -> ${player.name} (socketId: ${player.socketId})`);
        return { id: playerId, player };
      }
    }

    Logger.warn(`[findRoomPlayer] ルーム内でプレイヤーが見つかりません: ${gamePlayer.name} in room ${roomId}`);
    
    // フォールバック: 全プレイヤーから名前で検索
    Logger.debug(`[findRoomPlayer] フォールバック検索を実行: ${gamePlayer.name}`);
    for (const [playerId, player] of Object.entries(jsonData.players || {})) {
      if (player && player.name === gamePlayer.name && player.socketId) {
        Logger.debug(`[findRoomPlayer] フォールバック検索で見つかりました: ${playerId} -> ${player.name} (socketId: ${player.socketId})`);
        return { id: playerId, player };
      }
    }
    
    Logger.warn(`[findRoomPlayer] フォールバック検索でも見つかりません: ${gamePlayer.name}`);
    return null;
  }



  /**
   * リザルトURL生成
   */
  static buildResultUrl(resultType, roomId, playerId, reasonText = 'ゲーム終了') {
    const reason = encodeURIComponent(reasonText);
    return `result.html?result=${resultType}&reason=${reason}&roomId=${roomId}&playerId=${playerId}`;
  }

  /**
   * 勝者・敗者に結果を送信
   * options: { reasonText?: string, excludeCpu?: boolean }
   */
  static sendResultsToPlayers(io, roomId, winners, losers, jsonData, options = {}) {
    const { reasonText = 'ゲーム終了', excludeCpu = true } = options;

    // 敗者通知
    for (const loser of losers || []) {
      if (excludeCpu && typeof loser?.name === 'string' && loser.name.startsWith('cpu_')) {
        continue;
      }
      
      // gamePlayerオブジェクトからplayerIdを取得し、data.jsonから正確な情報を取得
      const playerInfo = SocketHandlers.getPlayerInfoFromGame(loser, jsonData);
      Logger.debug(`[Result] 敗者検索結果 ${loser.name}:`, playerInfo);
      
      if (playerInfo && playerInfo.player && playerInfo.player.socketId) {
        const url = SocketHandlers.buildResultUrl('lose', roomId, playerInfo.id, reasonText);
        Logger.debug(`[Result] 敗者リダイレクトURL: ${url}, socketId: ${playerInfo.player.socketId}`);
        io.to(playerInfo.player.socketId).emit('redirectToResult', { url });
        Logger.debug(`[Result] 敗者リダイレクト送信完了: ${loser.name}`);
      } else {
        Logger.error(`[Result] 敗者 ${loser.name} の接続情報が見つかりません:`, playerInfo);
      }
    }

    // 勝者通知
    for (const winner of winners || []) {
      if (excludeCpu && typeof winner?.name === 'string' && winner.name.startsWith('cpu_')) {
        continue;
      }
      
      // gamePlayerオブジェクトからplayerIdを取得し、data.jsonから正確な情報を取得
      const playerInfo = SocketHandlers.getPlayerInfoFromGame(winner, jsonData);
      Logger.debug(`[Result] 勝者検索結果 ${winner.name}:`, playerInfo);
      
      if (playerInfo && playerInfo.player && playerInfo.player.socketId) {
        const url = SocketHandlers.buildResultUrl('win', roomId, playerInfo.id, reasonText);
        Logger.debug(`[Result] 勝者リダイレクトURL: ${url}, socketId: ${playerInfo.player.socketId}`);
        io.to(playerInfo.player.socketId).emit('redirectToResult', { url });
        Logger.debug(`[Result] 勝者リダイレクト送信完了: ${winner.name}`);
      } else {
        Logger.error(`[Result] 勝者 ${winner.name} の接続情報が見つかりません:`, playerInfo);
      }
    }
  }

  /**
   * Ready状態処理
   */
  static async handleReady(data, io, activeGames) {
    Logger.debug('=== Ready Event Debug ===');
    Logger.debug(`playerId: ${data.playerId}, roomId: ${data.roomId}`);
    
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    // ルームのアクティビティを更新
    RoomManager.updateRoomActivity(data.roomId);
    
    // ゲーム開始時にロビー復帰意思をリセット
    RoomManager.resetLeaveWishes(data.roomId);
    
    if (data.playerId === 'cpu') {
      Logger.info('CPU戦が選択されました');
      // CPU戦の場合は1人でもゲーム開始可能
      const result = await GameService.startGame(data.roomId, io, activeGames);
      const { winners, losers, ok } = SocketHandlers.normalizeGameResult(result);
      Logger.debug(`[Result] CPU戦${ok ? '正常' : '早期'}終了処理開始: 勝者${winners.length}人, 敗者${losers.length}人`);

      // プレイヤーに結果を送信
      DataManager.loadData();
      const currentJsonData = DataManager.getJsonData();
      SocketHandlers.sendResultsToPlayers(io, data.roomId, winners, losers, currentJsonData, { reasonText: 'ゲーム終了', excludeCpu: true });

      Logger.debug(`[Result] CPU戦ゲーム終了結果送信完了: 勝者${winners.length}人, 敗者${losers.length}人`);
      
      // CPU戦終了後の処理
      RoomManager.setRoomPlayingStatus(data.roomId, false);
      
      // プレイヤーに結果を送信してから適切なタイミングで部屋を処理
      SocketHandlers.handleGameEndCleanup(data.roomId, io);
      
      if (ok) {
        DataManager.saveData();
      }
    } else {
      DataManager.loadData();
      const jsonData = DataManager.getJsonData();
      
      if (!jsonData.players[data.playerId]) {
        Logger.error(`プレイヤー ${data.playerId} が見つかりません`);
        return;
      }
      
      Logger.info(`プレイヤー戦: ${data.playerId} (${jsonData.players[data.playerId].name}) のready状態を1に設定`);
      jsonData.players[data.playerId].ready = 1;
      DataManager.saveData();
      
      const room = jsonData.rooms[data.roomId];
      if (!room) {
        Logger.error(`ルーム ${data.roomId} が見つかりません`);
        return;
      }
      
      let ready = 0;
      Logger.debug(`ルーム ${data.roomId} のプレイヤー数: ${room.players.length}`);
      for (let i = 0; i < room.players.length; i++) {
        const currentPlayerId = room.players[i];
        if (jsonData.players[currentPlayerId]) {
          const playerReady = jsonData.players[currentPlayerId].ready;
          const playerName = jsonData.players[currentPlayerId].name;
          Logger.debug(`プレイヤー ${currentPlayerId} (${playerName}) のready状態: ${playerReady}`);
          ready += playerReady;
        } else {
          Logger.debug(`プレイヤー ${currentPlayerId} のデータが見つかりません`);
        }
      }
      Logger.debug(`ready合計: ${ready}/${room.players.length}, ゲーム開始判定: ${ready == room.players.length && room.players.length >= 2}`);
      
      if (ready == room.players.length && room.players.length >= 2) {
        Logger.info(`プレイヤー戦開始条件満たす: ${room.players.length}人全員がready`);
        const result = await GameService.startGame(data.roomId, io, activeGames);
        
        if (result[0]) {
          const gameLog = result[1];
          const winners = result[2] || [];
          const losers = result[3] || [];
          Logger.debug(`[Result] プレイヤー戦正常終了処理開始: 勝者${winners.length}人, 敗者${losers.length}人`);
          // Logger.debug('[Result] Winners data:', JSON.stringify(winners, null, 2));
          // Logger.debug('[Result] Losers data:', JSON.stringify(losers, null, 2));
          
          // プレイヤーに結果を送信
          DataManager.loadData();
          const currentJsonData = DataManager.getJsonData();
          
          if (winners.length === 0 && losers.length === 2) {
            Logger.debug('[Result] 引き分け処理開始');
            const room = currentJsonData.rooms[data.roomId];
            if (room) {
                // ルームにいるプレイヤー全員に通知
                for (const playerId of room.players) {
                    const playerData = currentJsonData.players[playerId];
                    if (playerData && playerData.socketId && playerData.name !== 'cpu_1') {
                        const reason = encodeURIComponent('引き分け');
                        const url = `result.html?result=draw&reason=${reason}&roomId=${data.roomId}&playerId=${playerId}`;
                        io.to(playerData.socketId).emit('redirectToResult', { url: url });
                        Logger.debug(`[Result] 引き分けリダイレクト送信: ${playerData.name}`);
                    }
                }
            }
          }else{
            if (winners.length === 0 && losers.length === 2) {
              Logger.debug('[Result] 引き分け処理開始');
              const room = currentJsonData.rooms[data.roomId];
              if (room) {
                // ルームにいるプレイヤー全員に通知
                for (const playerId of room.players) {
                  const playerData = currentJsonData.players[playerId];
                  if (playerData && playerData.socketId && playerData.name !== 'cpu_1') {
                    const reason = encodeURIComponent('引き分け');
                    const url = `result.html?result=draw&reason=${reason}&roomId=${data.roomId}&playerId=${playerId}`;
                    io.to(playerData.socketId).emit('redirectToResult', { url: url });
                    Logger.debug(`[Result] 引き分けリダイレクト送信: ${playerData.name}`);
                  }
                }
              }
             }else{
              // 敗者への通知
              for (const loser of losers) {
                Logger.debug(`[Result] 敗者データ: id=${loser.id}, name=${loser.name}, constructor=${loser.constructor.name}`);
                
                // IDベースの検索のみを使用
                if (loser.id && currentJsonData.players[loser.id]) {
                  const playerId = loser.id;
                  const playerFound = SocketHandlers.findPlayerById(currentJsonData, playerId);
                  
                  if (playerFound && playerFound.player.socketId) {
                    const reason = encodeURIComponent('ゲーム終了');
                    const url = `result.html?result=lose&reason=${reason}&roomId=${data.roomId}&playerId=${playerId}`;
                    Logger.debug(`[Result] 敗者リダイレクトURL: ${url}, socketId: ${playerFound.player.socketId}`);
                    io.to(playerFound.player.socketId).emit('redirectToResult', { url: url });
                    Logger.debug(`[Result] 敗者リダイレクト送信完了: ${playerFound.player.name} (${playerId})`);
                  } else {
                    Logger.warn(`[Result] 敗者プレイヤーが見つからないかSocketIDがありません: id=${loser.id}, name=${loser.name}`);
                  }
                } else {
                  Logger.warn(`[Result] 敗者IDが無効またはプレイヤーが存在しません: id=${loser.id}, name=${loser.name}`);
                }
              }

              // 勝者への通知
              for (const winner of winners) {
                Logger.debug(`[Result] 勝者データ: id=${winner.id}, name=${winner.name}, constructor=${winner.constructor.name}`);
                
                // IDベースの検索のみを使用
                if (winner.id && currentJsonData.players[winner.id]) {
                  const playerId = winner.id;
                  const playerFound = SocketHandlers.findPlayerById(currentJsonData, playerId);
                  
                  if (playerFound && playerFound.player.socketId) {
                    const reason = encodeURIComponent('ゲーム終了');
                    const url = `result.html?result=win&reason=${reason}&roomId=${data.roomId}&playerId=${playerId}`;
                    Logger.debug(`[Result] 勝者リダイレクトURL: ${url}, socketId: ${playerFound.player.socketId}`);
                    io.to(playerFound.player.socketId).emit('redirectToResult', { url: url });
                    Logger.debug(`[Result] 勝者リダイレクト送信完了: ${playerFound.player.name} (${playerId})`);
                  } else {
                    Logger.warn(`[Result] 勝者プレイヤーが見つからないかSocketIDがありません: id=${winner.id}, name=${winner.name}`);
                  }
                } else {
                  Logger.warn(`[Result] 勝者IDが無効またはプレイヤーが存在しません: id=${winner.id}, name=${winner.name}`);
                }
              }
            }
            Logger.debug(`[Result] プレイヤー戦ゲーム終了結果送信完了: 勝者${winners.length}人, 敗者${losers.length}人`);
            
            // ゲーム終了後の適切なクリーンアップ
            RoomManager.setRoomPlayingStatus(data.roomId, false);
            SocketHandlers.handleGameEndCleanup(data.roomId, io);
            
            DataManager.saveData();
          }
        } else {
          Logger.debug(`ゲーム開始条件未満足: ready=${ready}/${room.players.length}, 最小人数=2`);
        }
      }
      Logger.debug('=== Ready Event Debug End ===');
    }
  }

  static handlePlayerSurrender(data, io, activeGames, pendingChoices) {
    Logger.info('投降受信', data);
    
    const { roomId, playerId } = data;
    if (!roomId || !playerId) {
      Logger.error('投降データ不足', { roomId, playerId });
      return;
    }
    
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (!jsonData.rooms[roomId]) {
      Logger.error('ルーム不存在', { roomId });
      return;
    }
    if (!jsonData.players[playerId]) {
      Logger.error('プレイヤー不存在', { playerId });
      return;
    }
    
    const game = activeGames[roomId]; 
    const room = jsonData.rooms[roomId];
    const isCpuGame = room.players.length === 1;

    const surrenderingSocketId = jsonData.players[playerId].socketId;
    if (pendingChoices[surrenderingSocketId]) {
        Logger.info(`choice関数中断: ${surrenderingSocketId}`);
        pendingChoices[surrenderingSocketId].reject(new Error('Player surrendered'));
    }
    
    if (game) {
        Logger.info(`ゲーム ${roomId} に強制投降送信`);
        game.forceSurrender(playerId);
    } else {
        Logger.warn('アクティブゲーム不存在、直接投降処理', { roomId });
    }

    Logger.info(`プレイヤー ${playerId} 投降`);
    
    jsonData.players[playerId].surrendered = true;
    jsonData.players[playerId].live = false;
    Logger.debug('投降フラグ設定', { playerId });
    
    const loserId = playerId;
    const winnerId = room.players.find(pId => pId !== loserId);
    Logger.debug('プレイヤー特定', { loserId, winnerId, isCpuGame });

    if (jsonData.players[loserId]) {
        jsonData.players[loserId].ready = 0;
        Logger.debug('敗者ready状態リセット', { loserId });
    }
    if (winnerId && jsonData.players[winnerId]) {
        jsonData.players[winnerId].ready = 0;
        Logger.debug('勝者ready状態リセット', { winnerId });
    }
    DataManager.saveData();

    const loserSocketId = jsonData.players[loserId].socketId;
    if (loserSocketId) {
    const url = SocketHandlers.buildResultUrl('lose', roomId, loserId, 'あなたが降参しました。');
        Logger.info('敗者リダイレクト送信', { loserSocketId });
        io.to(loserSocketId).emit('redirectToResult', { url: url });
    } else {
        Logger.warn('敗者SocketID不存在', { loserId });
    }

    if (winnerId && !isCpuGame) {
        const winnerSocketId = jsonData.players[winnerId].socketId;
        if (winnerSocketId) {
      const url = SocketHandlers.buildResultUrl('win', roomId, winnerId, '相手が降参しました。');
            Logger.info('勝者リダイレクト送信', { winnerSocketId });
            io.to(winnerSocketId).emit('redirectToResult', { url: url });
        } else {
            Logger.warn('勝者SocketID不存在', { winnerId });
        }
    } else if (isCpuGame) {
        Logger.info('CPU戦のため勝者リダイレクトスキップ', { roomId });
    } else {
        Logger.warn('勝者特定失敗', { roomId });
    }
    
    if (activeGames[roomId]) {
        delete activeGames[roomId];
        Logger.info('投降によりアクティブゲーム削除', { roomId });
    }
    
    RoomManager.setRoomPlayingStatus(roomId, false);
    
    // 投降によるゲーム終了後の適切なクリーンアップ
    SocketHandlers.handleGameEndCleanup(roomId, io);
    
    Logger.info('投降処理完了', { roomId, playerId });
  }

  /**
   * 再戦リクエスト処理
   */
  static handleRequestRematch(socket, data, io) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    jsonData.rooms[data.roomId].playing = false;
    
    const { roomId, playerId } = data;
    
    if (!roomId || !playerId) {
      Logger.error('無効な再戦リクエストを受け取りました。');
      return;
    }

    Logger.info(`${playerId} からルーム ${roomId} への再戦リクエストを受け取りました。`);
    const room = jsonData.rooms[roomId];

    if (room.players.length >= CONFIG.MAX_PLAYERS_PER_ROOM) {
        Logger.info(`ルーム ${roomId} の初回再戦リクエスト。プレイヤーリストとready状態をリセットします。`);
        
        for (const existingPlayerId of room.players) {
          if (jsonData.players[existingPlayerId]) {
            jsonData.players[existingPlayerId].ready = 0;
            Logger.debug(`プレイヤー ${existingPlayerId} のready状態をリセット`);
          }
        }
        
        room.players = [];
    }
    
    if (jsonData.players[playerId]) {
      jsonData.players[playerId].ready = 0;
      Logger.debug(`再戦リクエストプレイヤー ${playerId} のready状態をリセット`);
    }
    
    RoomManager.addPlayerToRoomUnique(roomId, playerId);
    Logger.info(`ルーム ${roomId} に ${playerId} が参加。現在のメンバー:`, room.players);

    socket.join(roomId);
    if (jsonData.players[playerId]) {
        Logger.debug(`プレイヤー ${playerId} の socketId を更新: ${socket.id}`);
        jsonData.players[playerId].socketId = socket.id;
    }
    
    DataManager.saveData();
    
    const playersString = room.players.join(','); 

    socket.broadcast.to(roomId).emit('opponentRequestedRematch', { name: jsonData.players[playerId].name });
    Logger.debug(`--> ルーム内の全員に "opponentRequestedRematch" を送信しました`);
    
    const url = `game.html?roomId=${roomId}&playerId=${playerId}&players=${playersString}`;
    socket.emit('navigateToGame', { url: url });
    Logger.debug(`${playerId} に遷移指示を送信: ${url}`);
  }

  /**
   * プレイヤーアクション処理
   */
  static handlePlayerAction(socket, roomId, actionData, io) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    const room = jsonData.rooms[roomId];
    if (!room) return;

    io.to(roomId).emit('gameStateUpdate', {
      playerId: socket.id,
      action: actionData,
    });
  }

  /**
   * リザルトページ識別処理
   */
  static handleIdentifyResultPage(socket, data) {
    const { roomId, playerId } = data;
    if (roomId && playerId) {
        Logger.info(`リザルトページのクライアント ${playerId} をルーム ${roomId} に参加させます。`);
        socket.join(roomId);
        
        // プレイヤーがリザルト画面に到達したことを記録
        SocketHandlers.markPlayerReachedResult(roomId, playerId);
    }
  }

  /**
   * プレイヤーがリザルト画面に到達したことを記録
   * @param {string} roomId - ルームID
   * @param {string} playerId - プレイヤーID
   */
  static markPlayerReachedResult(roomId, playerId) {
    try {
      DataManager.loadData();
      const jsonData = DataManager.getJsonData();
      
      if (jsonData.rooms[roomId] && jsonData.players[playerId]) {
        if (!jsonData.rooms[roomId].playersReachedResult) {
          jsonData.rooms[roomId].playersReachedResult = [];
        }
        
        if (!jsonData.rooms[roomId].playersReachedResult.includes(playerId)) {
          jsonData.rooms[roomId].playersReachedResult.push(playerId);
          Logger.debug(`[RoomCleanup] プレイヤー ${playerId} がリザルト画面に到達`);
          
          DataManager.saveData();
          
          // 全プレイヤーがリザルト画面に到達した場合、クリーンアップを加速
          SocketHandlers.checkAllPlayersReachedResult(roomId);
        }
      }
    } catch (e) {
      Logger.error(`[RoomCleanup] リザルト到達記録エラー ${roomId}/${playerId}:`, e);
    }
  }

  /**
   * 全プレイヤーがリザルト画面に到達したかチェック
   * @param {string} roomId - ルームID
   */
  static checkAllPlayersReachedResult(roomId) {
    try {
      DataManager.loadData();
      const jsonData = DataManager.getJsonData();
      const room = jsonData.rooms[roomId];
      
      if (!room) return;
      
      const humanPlayers = room.players.filter(playerId => {
        const player = jsonData.players[playerId];
        return player && !player.name.startsWith('cpu_');
      });
      
      const reachedPlayers = room.playersReachedResult || [];
      
      if (humanPlayers.length > 0 && reachedPlayers.length >= humanPlayers.length) {
        Logger.info(`[RoomCleanup] 全プレイヤーがリザルト到達、ルーム ${roomId} の即座クリーンアップを実行`);
        // 少し遅延を設けて安全に削除
        setTimeout(() => {
          RoomManager.removeRoom(roomId);
        }, 5000);
      }
    } catch (e) {
      Logger.error(`[RoomCleanup] 全プレイヤー到達チェックエラー ${roomId}:`, e);
    }
  }

  /**
   * ルーム削除処理
   */
  static handleDeleteRoom(socket, data, callback, io) {
    const { roomId, adminPassword } = data;
    
    // 簡単な管理者認証（実際のプロダクションではより堅牢な認証が必要）
    if (adminPassword !== process.env.ADMIN_PASSWORD && adminPassword !== 'admin123') {
      if (callback) {
        callback({ success: false, message: '権限がありません' });
      }
      return;
    }

    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    const room = jsonData.rooms[roomId];

    if (!room) {
      if (callback) {
        callback({ success: false, message: 'ルームが存在しません' });
      }
      return;
    }

    // ゲーム中の場合は削除を拒否
    if (room.playing) {
      if (callback) {
        callback({ success: false, message: 'ゲーム中のため削除できません' });
      }
      return;
    }

    // ルーム内の全プレイヤーに通知
    room.players.forEach(playerId => {
      const player = jsonData.players[playerId];
      if (player && player.socketId) {
        io.to(player.socketId).emit('roomDeleted', { roomId, reason: '管理者によりルームが削除されました' });
      }
    });

    // ルーム削除実行
    const deleted = RoomManager.forceDeleteRoom(roomId);
    
    if (callback) {
      callback({ 
        success: deleted, 
        message: deleted ? 'ルームを削除しました' : 'ルーム削除に失敗しました' 
      });
    }

    Logger.info(`管理者によるルーム削除: ${roomId}`);
  }



  /**
   * プレイヤーがロビーに戻ることを選択した場合の処理
   */
  static handleReturnToLobby(socket, data, io) {
    const { roomId, playerId } = data;

    if (!roomId || !playerId) {
      Logger.error('無効なロビー復帰リクエストを受け取りました。');
      return;
    }

    Logger.info(`プレイヤー ${playerId} がルーム ${roomId} からロビーに戻ることを選択`);

    // プレイヤーのロビー復帰意思を記録
    const playersWantingToLeave = RoomManager.markPlayerWantsToLeave(roomId, playerId);

    // ルーム内の他のプレイヤーに通知
    socket.to(roomId).emit('playerWantsToLeave', { 
      playerId, 
      playersWantingToLeave,
      message: `プレイヤーがロビーに戻ることを選択しました (${playersWantingToLeave}人目)` 
    });

    // 全プレイヤーがロビーに戻りたいかチェック
    if (RoomManager.checkAllPlayersWantToLeave(roomId)) {
      Logger.info(`ルーム ${roomId} の全プレイヤーがロビー復帰を希望 - ルーム削除処理開始`);

      // ルーム内の全プレイヤーに削除通知
      DataManager.loadData();
      const jsonData = DataManager.getJsonData();
      const room = jsonData.rooms[roomId];

      if (room) {
        room.players.forEach(pId => {
          const player = jsonData.players[pId];
          if (player && player.socketId && !player.name.startsWith('cpu_')) {
            io.to(player.socketId).emit('roomDissolved', { 
              roomId, 
              reason: '全プレイヤーがロビーに戻ることを選択したため、ルームが解散されました'
            });
          }
        });

        // ルーム削除実行
        RoomManager.removeRoom(roomId);
        Logger.info(`全プレイヤー合意によりルーム削除: ${roomId}`);
        
        // クライアントに適切な通知
        io.emit('roomCleaned', { roomId });
      } else {
        Logger.debug(`[ReturnToLobby] ルーム ${roomId} が見つかりません`);
      }
    }
  }

  /**
   * ゲーム状態確認処理
   * @param {Object} data - { roomId, playerId }
   * @param {Function} callback - コールバック関数
   */
  static handleCheckGameStatus(data, callback) {
    try {
      const { roomId, playerId } = data;
      Logger.debug(`[CheckGameStatus] roomId: ${roomId}, playerId: ${playerId}`);
      
      if (!roomId || !playerId) {
        return callback({ error: 'Invalid parameters', gameEnded: false });
      }
      
      DataManager.loadData();
      const jsonData = DataManager.getJsonData();
      const room = jsonData.rooms[roomId];
      
      if (!room) {
        Logger.debug(`[CheckGameStatus] ルーム ${roomId} が存在しません`);
        return callback({ gameEnded: true, reason: 'room_not_found' });
      }
      
      // プレイヤーがルームに存在するか確認
      const playerExists = room.players.includes(playerId);
      
      if (!playerExists) {
        Logger.debug(`[CheckGameStatus] プレイヤー ${playerId} がルーム ${roomId} に存在しません`);
        return callback({ gameEnded: true, reason: 'player_not_in_room' });
      }
      
      // ゲームが終了しているか確認
      const gameEnded = !room.playing;
      
      Logger.debug(`[CheckGameStatus] ルーム ${roomId} playing: ${room.playing}, gameEnded: ${gameEnded}`);
      
      callback({
        gameEnded: gameEnded,
        roomPlaying: room.playing,
        playerCount: room.players.length,
        reason: gameEnded ? 'game_completed' : 'game_in_progress'
      });
      
    } catch (error) {
      Logger.error(`[CheckGameStatus] エラー:`, error);
      callback({ error: 'Internal error', gameEnded: true });
    }
  }

  /**
   * ゲーム終了後の適切なクリーンアップ処理
   * @param {string} roomId - 対象ルームID
   * @param {object} io - Socket.IOサーバーインスタンス
   */
  static handleGameEndCleanup(roomId, io) {
    Logger.debug(`[GameEndCleanup] ルーム ${roomId} のゲーム終了後クリーンアップ開始`);
    
    // リザルト画面の表示時間を考慮して適切な遅延を設定
    setTimeout(() => {
      DataManager.loadData();
      const jsonData = DataManager.getJsonData();
      const room = jsonData.rooms[roomId];
      
      if (!room) {
        Logger.debug(`[GameEndCleanup] ルーム ${roomId} は既に削除済み`);
        return;
      }
      
      // プレイヤーが0人になったら即座に削除、そうでなければプレイヤーの意思に委ねる
      if (room.players.length === 0) {
        RoomManager.removeRoom(roomId);
        Logger.info(`[GameEndCleanup] 空ルーム削除: ${roomId}`);
        io.emit('roomCleaned', { roomId });
      } else {
        Logger.debug(`[GameEndCleanup] ルーム ${roomId} にはまだプレイヤーが残っています (${room.players.length}人)`);
        // プレイヤーが残っている場合は自動削除しない
        // returnToLobby処理に委ねる
      }
    }, 10000); // 10秒後（リザルト画面表示に十分な時間）
  }

  /**
   * プレイヤー切断時の処理
   * @param {string} socketId - 切断されたプレイヤーのSocketID
   * @param {object} io - Socket.IOサーバーインスタンス
   */
  static handlePlayerDisconnect(socketId, io) {
    Logger.debug(`[PlayerDisconnect] プレイヤー切断処理開始: ${socketId}`);
    
    // 即座にクリーンアップを実行
    setTimeout(() => {
      const cleanedRooms = RoomManager.cleanupEmptyRooms();
      if (cleanedRooms.length > 0) {
        Logger.info(`[PlayerDisconnect] 切断によるクリーンアップ完了: ${cleanedRooms.length}ルーム削除`);
        cleanedRooms.forEach(roomId => {
          io.emit('roomCleaned', { roomId });
        });
      }
    }, 2000); // 2秒後（データ整合性確保）
  }

  /**
   * ルームのクリーンアップをスケジュール（レガシー、非推奨）
   * @param {string} roomId - クリーンアップするルームID
   * @param {object} io - Socket.IOサーバーインスタンス
   * @deprecated handleGameEndCleanupを使用してください
   */
  static scheduleRoomCleanup(roomId, io) {
    Logger.debug(`[RoomCleanup] ルーム ${roomId} のクリーンアップをスケジュール`);
    
    // 30秒後にルームをクリーンアップ
    setTimeout(() => {
      try {
        const removed = RoomManager.removeRoom(roomId);
        if (removed) {
          Logger.info(`[RoomCleanup] ルーム ${roomId} のスケジュールクリーンアップ完了`);
          // 必要に応じてクライアントに通知
          io.emit('roomCleaned', { roomId });
        } else {
          Logger.debug(`[RoomCleanup] ルーム ${roomId} は既に削除済み`);
        }
      } catch (error) {
        Logger.error(`[RoomCleanup] ルーム ${roomId} のクリーンアップエラー:`, error);
      }
    }, 30000); // 30秒後
  }

  /**
   * ランダムなルームIDを生成
   * @returns {string} 生成されたルームID（'room-'プレフィックス付き）
   */
  static generateRoomId() {
    return 'room-' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = SocketHandlers;