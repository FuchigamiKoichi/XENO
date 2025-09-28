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
        playing: false 
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
}

module.exports = RoomManager;