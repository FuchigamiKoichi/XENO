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

      // ルーム削除リクエスト（管理者用）
      socket.on('deleteRoom', (data, callback) => {
        this.handleDeleteRoom(socket, data, callback, io);
      });



      // ロビーに戻る選択
      socket.on('returnToLobby', (data) => {
        this.handleReturnToLobby(socket, data, io);
      });

      socket.on('disconnect', () => {
        Logger.info(`ユーザ切断: ${socket.id}`);
        
        // 切断時に空ルームをクリーンアップ
        setTimeout(() => {
          RoomManager.cleanupEmptyRooms();
        }, 5000); // 5秒後にクリーンアップ実行
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
    const roomId = this.generateRoomId();
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
    
    // ルームのアクティビティを更新
    RoomManager.updateRoomActivity(data.roomId);
    
    // ゲーム開始時にロビー復帰意思をリセット
    RoomManager.resetLeaveWishes(data.roomId);
    
    if (data.playerId === 'cpu') {
      Logger.info('CPU戦が選択されました');
      // CPU戦の場合は1人でもゲーム開始可能
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
          
          // const winnerId = result.winners[0].id;
          if (matchScores[roomId] && winnerId) {
            matchScores[roomId][winnerId]++;
          }
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
      } else {
        Logger.debug(`ゲーム開始条件未満足: ready=${ready}/${room.players.length}, 最小人数=2`);
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
      }
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