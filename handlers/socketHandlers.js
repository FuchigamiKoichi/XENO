const CONFIG = require('../config/config');
const Logger = require('../utils/logger');
const DataManager = require('../managers/dataManager');
const RoomManager = require('../managers/roomManager');
const GameService = require('../services/gameService');

/**
 * Socket.IOイベント処理
 */
class SocketHandlers {
  static setupHandlers(io, activeGames, pendingChoices) {
    io.on('connection', (socket) => {
              // プレイヤー名からプレイヤーデータを検索   Logger.info('ユーザ接続:', socket.id);

      // プレイヤー登録
      socket.on('registPlayer', (data) => {
        this.handleRegistPlayer(socket, data);
      });

      // ルーム作成
      socket.on('createRoom', (data, callback) => {
        this.handleCreateRoom(socket, data, callback);
      });

      // ルーム参加
      socket.on('joinRoom', (roomId, callback) => {
        this.handleJoinRoom(socket, roomId, callback);
      });

      // ルーム表示
      socket.on('showRooms', (data, callback) => {
        this.handleShowRooms(callback);
      });

      // SocketID変更
      socket.on('changeSocketid', (data) => {
        this.handleChangeSocketId(socket, data, io);
      });

      // プレイヤー名取得
      socket.on('getPlayerNames', (data, callback) => {
        this.handleGetPlayerNames(data, callback);
      });

      // 権限クラス取得
      socket.on('getPermissionClass', (data, callback) => {
        this.handleGetPermissionClass(data, callback);
      });

      // ゲーム開始
      socket.on('startGame', (roomId) => {
        this.handleStartGame(roomId, io);
      });

      // Ready状態
      socket.on('ready', async (data) => {
        await this.handleReady(data, io, activeGames);
      });

      // プレイヤー投降
      socket.on('playerSurrender', (data) => {
        this.handlePlayerSurrender(data, io, activeGames, pendingChoices);
      });

      // 再戦リクエスト
      socket.on('requestRematch', (data) => {
        this.handleRequestRematch(socket, data, io);
      });

      // プレイヤーアクション
      socket.on('playerAction', (roomId, actionData) => {
        this.handlePlayerAction(roomId, actionData, io);
      });

      // リザルトページ識別
      socket.on('identifyResultPage', (data) => {
        this.handleIdentifyResultPage(socket, data);
      });

      socket.on('disconnect', () => {
        Logger.info('ユーザ切断:', socket.id);
      });
    });
  }

  static handleRegistPlayer(socket, data) {
    const playerData = { id: socket.id, name: data.name, ready: 0 };
    DataManager.addPlayer(playerData);
    Logger.info(`プレイヤー登録: ${playerData.name}`);
  }

  /**
   * ルーム作成処理
   */
  static handleCreateRoom(socket, data, callback) {
    const roomId = this.generateRoomId();
    const roomData = {
      id: roomId, 
      owner: socket.id, 
      players: [socket.id], 
      maxPlayers: CONFIG.MAX_PLAYERS_PER_ROOM, 
      playing: false
    };
    
    RoomManager.addRoom(roomData);
    
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    const playerName = jsonData.players[socket.id]?.name || 'Unknown';
    Logger.info(`ルーム作成: ${roomId}, オーナー: ${playerName}`);
    
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
        DataManager.saveData();
    }
    
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
   * ゲーム開始処理
   */
  static handleStartGame(roomId, io) {
    Logger.info('startGame:', roomId);
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    io.to(roomId).emit('startGame', {players: jsonData.rooms[roomId].players});
  }

  /**
   * Ready状態処理
   */
  static async handleReady(data, io, activeGames) {
    Logger.debug('=== Ready Event Debug ===');
    Logger.debug(`playerId: ${data.playerId}, roomId: ${data.roomId}`);
    
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (data.playerId === 'cpu') {
      Logger.info('CPU戦が選択されました');
      const result = await GameService.startGame(data.roomId, io, activeGames);
      
      if (result[0]) {
        const gameLog = result[1];
        const winners = result[2] || [];
        const losers = result[3] || [];
        Logger.debug(`[Result] CPU戦正常終了処理開始: 勝者${winners.length}人, 敗者${losers.length}人`);
        
        // プレイヤーに結果を送信
        DataManager.loadData();
        const currentJsonData = DataManager.getJsonData();
        
        // 敗者への通知
        for (const loser of losers) {
          if (loser.name !== 'cpu_1') {
            // プレイヤー名からプレイヤーデータを検索
            const playerName = loser.name;
            const loserData = Object.values(currentJsonData.players).find(p => p.name === playerName);
            if (loserData && loserData.socketId) {
              const reason = encodeURIComponent('ゲーム終了');
              const url = `result.html?result=lose&reason=${reason}&roomId=${data.roomId}&playerId=${Object.keys(currentJsonData.players).find(key => currentJsonData.players[key] === loserData)}`;
              io.to(loserData.socketId).emit('redirectToResult', { url: url });
              Logger.debug(`[Result] 敗者リダイレクト送信: ${playerName}`);
            }
          }
        }
        
        // 勝者への通知
        for (const winner of winners) {
          if (winner.name !== 'cpu_1') {
            // プレイヤー名からプレイヤーデータを検索
            const playerName = winner.name;
            const winnerData = Object.values(currentJsonData.players).find(p => p.name === playerName);
            if (winnerData && winnerData.socketId) {
              const reason = encodeURIComponent('ゲーム終了');
              const url = `result.html?result=win&reason=${reason}&roomId=${data.roomId}&playerId=${Object.keys(currentJsonData.players).find(key => currentJsonData.players[key] === winnerData)}`;
              io.to(winnerData.socketId).emit('redirectToResult', { url: url });
              Logger.debug(`[Result] 勝者リダイレクト送信: ${playerName}`);
            }
          }
        }
        
        Logger.debug(`[Result] CPU戦ゲーム終了結果送信完了: 勝者${winners.length}人, 敗者${losers.length}人`);
        DataManager.saveData();
      } else {
        // ゲーム終了時の結果処理
        Logger.debug(`[Result] ゲーム終了処理開始: result=${JSON.stringify(result)}`);
        const winners = result[1];
        const losers = result[2];
        Logger.debug(`[Result] 勝者: ${winners.length}人, 敗者: ${losers.length}人`);
        
        // プレイヤーに結果を送信
        DataManager.loadData();
        const currentJsonData = DataManager.getJsonData();
        
        // 敗者への通知
        for (const loser of losers) {
          if (loser.name !== 'cpu_1') {
            // プレイヤー名からプレイヤーデータを検索
            const playerName = loser.name;
            const loserData = Object.values(currentJsonData.players).find(p => p.name === playerName);
            if (loserData && loserData.socketId) {
              const reason = encodeURIComponent('ゲーム終了');
              const url = `result.html?result=lose&reason=${reason}&roomId=${data.roomId}&playerId=${Object.keys(currentJsonData.players).find(key => currentJsonData.players[key] === loserData)}`;
              io.to(loserData.socketId).emit('redirectToResult', { url: url });
            }
          }
        }
        
        // 勝者への通知
        for (const winner of winners) {
          if (winner.name !== 'cpu_1') {
            // プレイヤー名からプレイヤーデータを検索
            const playerName = winner.name;
            const winnerData = Object.values(currentJsonData.players).find(p => p.name === playerName);
            if (winnerData && winnerData.socketId) {
              const reason = encodeURIComponent('ゲーム終了');
              const url = `result.html?result=win&reason=${reason}&roomId=${data.roomId}&playerId=${Object.keys(currentJsonData.players).find(key => currentJsonData.players[key] === winnerData)}`;
              io.to(winnerData.socketId).emit('redirectToResult', { url: url });
            }
          }
        }
        
        Logger.debug(`[Result] ゲーム終了結果送信完了: 勝者${winners.length}人, 敗者${losers.length}人`);
      }
    } else {
      DataManager.loadData();
      Logger.info(`プレイヤー戦: ${data.playerId} のready状態を1に設定`);
      jsonData.players[data.playerId].ready = 1;
      DataManager.saveData();
      
      let ready = 0;
      for (let i = 0; i < jsonData.rooms[data.roomId].players.length; i++) {
        const currentPlayerId = jsonData.rooms[data.roomId].players[i];
        if (jsonData.players[currentPlayerId]) {
          Logger.debug(`プレイヤー ${currentPlayerId} のready状態: ${jsonData.players[currentPlayerId].ready}`);
          ready += jsonData.players[currentPlayerId].ready;
        }
      }
      Logger.debug(`total ready: ${ready}`);
      Logger.debug(`ready合計: ${ready}, ゲーム開始判定: ${ready == 2}`);
      
      if (ready == 2) {
        const result = await GameService.startGame(data.roomId, io, activeGames);
        
        if (result[0]) {
          const gameLog = result[1];
          const winners = result[2] || [];
          const losers = result[3] || [];
          Logger.debug(`[Result] プレイヤー戦正常終了処理開始: 勝者${winners.length}人, 敗者${losers.length}人`);
          
          // プレイヤーに結果を送信
          DataManager.loadData();
          const currentJsonData = DataManager.getJsonData();
          
          // 敗者への通知
          for (const loser of losers) {
            // プレイヤー名からプレイヤーデータを検索
            const playerName = loser.name;
            const loserData = Object.values(currentJsonData.players).find(p => p.name === playerName);
            if (loserData && loserData.socketId) {
              const reason = encodeURIComponent('ゲーム終了');
              const url = `result.html?result=lose&reason=${reason}&roomId=${data.roomId}&playerId=${Object.keys(currentJsonData.players).find(key => currentJsonData.players[key] === loserData)}`;
              io.to(loserData.socketId).emit('redirectToResult', { url: url });
              Logger.debug(`[Result] 敗者リダイレクト送信: ${playerName}`);
            }
          }
          
          // 勝者への通知
          for (const winner of winners) {
            // プレイヤー名からプレイヤゲータを検索
            const playerName = winner.name;
            const winnerData = Object.values(currentJsonData.players).find(p => p.name === playerName);
            if (winnerData && winnerData.socketId) {
              const reason = encodeURIComponent('ゲーム終了');
              const url = `result.html?result=win&reason=${reason}&roomId=${data.roomId}&playerId=${Object.keys(currentJsonData.players).find(key => currentJsonData.players[key] === winnerData)}`;
              io.to(winnerData.socketId).emit('redirectToResult', { url: url });
              Logger.debug(`[Result] 勝者リダイレクト送信: ${playerName}`);
            }
          }
          
          Logger.debug(`[Result] プレイヤー戦ゲーム終了結果送信完了: 勝者${winners.length}人, 敗者${losers.length}人`);
          DataManager.saveData();
        } else {
          // ゲーム終了時の結果処理
          Logger.debug(`[Result] プレイヤー戦ゲーム終了処理開始: result=${JSON.stringify(result)}`);
          const winners = result[1];
          const losers = result[2];
          Logger.debug(`[Result] 勝者: ${winners.length}人, 敗者: ${losers.length}人`);
          
          // プレイヤーに結果を送信
          DataManager.loadData();
          const currentJsonData = DataManager.getJsonData();
          
          // 敗者への通知
          for (const loser of losers) {
            // プレイヤー名からプレイヤーデータを検索
            const playerName = loser.name;
            const loserData = Object.values(currentJsonData.players).find(p => p.name === playerName);
            if (loserData && loserData.socketId) {
              const reason = encodeURIComponent('ゲーム終了');
              const url = `result.html?result=lose&reason=${reason}&roomId=${data.roomId}&playerId=${Object.keys(currentJsonData.players).find(key => currentJsonData.players[key] === loserData)}`;
              io.to(loserData.socketId).emit('redirectToResult', { url: url });
            }
          }
          
          // 勝者への通知
          for (const winner of winners) {
            // プレイヤー名からプレイヤーデータを検索
            const playerName = winner.name;
            const winnerData = Object.values(currentJsonData.players).find(p => p.name === playerName);
            if (winnerData && winnerData.socketId) {
              const reason = encodeURIComponent('ゲーム終了');
              const url = `result.html?result=win&reason=${reason}&roomId=${data.roomId}&playerId=${Object.keys(currentJsonData.players).find(key => currentJsonData.players[key] === winnerData)}`;
              io.to(winnerData.socketId).emit('redirectToResult', { url: url });
            }
          }
          
          Logger.debug(`[Result] プレイヤー戦ゲーム終了結果送信完了: 勝者${winners.length}人, 敗者${losers.length}人`);
        }
      }
    }
    Logger.debug('=== Ready Event Debug End ===');
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
        const reason = encodeURIComponent('あなたが降参しました。');
        const url = `result.html?result=lose&reason=${reason}&roomId=${roomId}&playerId=${loserId}`;
        Logger.info('敗者リダイレクト送信', { loserSocketId });
        io.to(loserSocketId).emit('redirectToResult', { url: url });
    } else {
        Logger.warn('敗者SocketID不存在', { loserId });
    }

    if (winnerId && !isCpuGame) {
        const winnerSocketId = jsonData.players[winnerId].socketId;
        if (winnerSocketId) {
            const reason = encodeURIComponent('相手が降参しました。');
            const url = `result.html?result=win&reason=${reason}&roomId=${roomId}&playerId=${winnerId}`;
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
  static handlePlayerAction(roomId, actionData, io) {
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
    }
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