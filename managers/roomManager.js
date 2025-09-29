const CONFIG = require('../config/config');
const Logger = require('../utils/logger');
const DataManager = require('./dataManager');

/**
 * ルーム作成・参加・削除の管理
 */
class RoomManager {
  static addRoom(roomData) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (!jsonData.rooms[roomData.id]) {
      jsonData.rooms[roomData.id] = { 
        owner: roomData.owner, 
        players: [], 
        maxPlayers: roomData.maxPlayers, 
        playing: false,
        lastActivity: Date.now(),
        playersWantingToLeave: [] // ロビーに戻りたいプレイヤーのリスト
      };
      DataManager.saveData();
    }
  }

  static getRooms() {
    DataManager.loadData();
    return DataManager.getJsonData().rooms;
  }

  static addPlayerToRoomUnique(roomId, playerId) {
    const jsonData = DataManager.getJsonData();
    
    if (jsonData.rooms[roomId]) {
      const players = jsonData.rooms[roomId].players;
      if (!players.includes(playerId)) {
        players.push(playerId);
        Logger.info(`プレイヤー ${playerId} → ルーム ${roomId}`);
        return true;
      } else {
        Logger.debug(`プレイヤー ${playerId} は既にルーム ${roomId} に存在`);
        return false;
      }
    }
    return false;
  }

  static removePlayerFromRoom(roomId, playerId) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (jsonData.rooms[roomId]) {
      const room = jsonData.rooms[roomId];
      const index = room.players.indexOf(playerId);
      if (index > -1) {
        room.players.splice(index, 1);
        Logger.info(`プレイヤー ${playerId} ← ルーム ${roomId} から削除`);
        DataManager.saveData();
      }
    }
  }

  static removeRoom(roomId) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (jsonData.rooms[roomId]) {
      delete jsonData.rooms[roomId];
      Logger.info(`ルーム ${roomId} 削除`);
      DataManager.saveData();
    }
  }

  static setRoomPlayingStatus(roomId, playing) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (jsonData.rooms[roomId]) {
      jsonData.rooms[roomId].playing = playing;
      DataManager.saveData();
      Logger.debug(`ルーム ${roomId} playing: ${playing}`);
    }
  }

  /**
   * 空のルームを自動削除
   */
  static cleanupEmptyRooms() {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    const rooms = jsonData.rooms;
    const deletedRooms = [];

    for (const roomId in rooms) {
      const room = rooms[roomId];
      // 条件：プレイヤーが0人 かつ ゲーム中でない
      if (room.players.length === 0 && !room.playing) {
        delete jsonData.rooms[roomId];
        deletedRooms.push(roomId);
        Logger.info(`空ルーム削除: ${roomId}`);
      }
    }

    if (deletedRooms.length > 0) {
      DataManager.saveData();
      Logger.info(`空ルームクリーンアップ完了: ${deletedRooms.length}件削除`);
    }

    return deletedRooms;
  }

  /**
   * 特定ルームの削除（管理者用）
   */
  static forceDeleteRoom(roomId) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (jsonData.rooms[roomId]) {
      delete jsonData.rooms[roomId];
      DataManager.saveData();
      Logger.info(`強制ルーム削除: ${roomId}`);
      return true;
    }
    return false;
  }

  /**
   * 非アクティブルームの削除
   * @param {number} inactiveHours - 非アクティブ時間（時間）
   */
  static cleanupInactiveRooms(inactiveHours = 24) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    const rooms = jsonData.rooms;
    const deletedRooms = [];
    const cutoffTime = Date.now() - (inactiveHours * 60 * 60 * 1000);

    for (const roomId in rooms) {
      const room = rooms[roomId];
      // lastActivityがない場合は現在時刻を設定
      if (!room.lastActivity) {
        room.lastActivity = Date.now();
        continue;
      }

      // 非アクティブかつゲーム中でない場合削除
      if (room.lastActivity < cutoffTime && !room.playing) {
        delete jsonData.rooms[roomId];
        deletedRooms.push(roomId);
        Logger.info(`非アクティブルーム削除: ${roomId}`);
      }
    }

    if (deletedRooms.length > 0) {
      DataManager.saveData();
      Logger.info(`非アクティブルームクリーンアップ完了: ${deletedRooms.length}件削除`);
    }

    return deletedRooms;
  }

  /**
   * ルームの最終アクティビティ時刻を更新
   */
  static updateRoomActivity(roomId) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (jsonData.rooms[roomId]) {
      jsonData.rooms[roomId].lastActivity = Date.now();
      DataManager.saveData();
    }
  }

  /**
   * プレイヤーのロビー復帰意思を記録
   */
  static markPlayerWantsToLeave(roomId, playerId) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (jsonData.rooms[roomId]) {
      const room = jsonData.rooms[roomId];
      if (!room.playersWantingToLeave) {
        room.playersWantingToLeave = [];
      }
      
      if (!room.playersWantingToLeave.includes(playerId)) {
        room.playersWantingToLeave.push(playerId);
        Logger.info(`プレイヤー ${playerId} がルーム ${roomId} からの退室を希望`);
      }
      
      DataManager.saveData();
      return room.playersWantingToLeave.length;
    }
    
    return 0;
  }

  /**
   * 全プレイヤーがロビーに戻りたいかチェック
   */
  static checkAllPlayersWantToLeave(roomId) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (jsonData.rooms[roomId]) {
      const room = jsonData.rooms[roomId];
      
      if (!room.playersWantingToLeave) {
        return false;
      }
      
      // CPUプレイヤーを除外したプレイヤー数
      const humanPlayers = room.players.filter(playerId => {
        const player = jsonData.players[playerId];
        return player && !player.name.startsWith('cpu_');
      });
      
      const allWantToLeave = humanPlayers.length > 0 && 
                            humanPlayers.every(playerId => 
                              room.playersWantingToLeave.includes(playerId)
                            );
      
      if (allWantToLeave) {
        Logger.info(`ルーム ${roomId} の全プレイヤーがロビー復帰を希望`);
      }
      
      return allWantToLeave;
    }
    
    return false;
  }

  /**
   * ロビー復帰意思をリセット（ゲーム開始時などに使用）
   */
  static resetLeaveWishes(roomId) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    if (jsonData.rooms[roomId]) {
      jsonData.rooms[roomId].playersWantingToLeave = [];
      DataManager.saveData();
      Logger.debug(`ルーム ${roomId} のロビー復帰意思をリセット`);
    }
  }
}

module.exports = RoomManager;