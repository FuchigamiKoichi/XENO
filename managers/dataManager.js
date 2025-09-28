const fs = require('fs');
const CONFIG = require('../config/config');
const Logger = require('../utils/logger');

let jsonData = { rooms: {}, players: {}, logs: [] };

/**
 * JSONファイルの読み書きとプレイヤー管理
 */
class DataManager {
  static loadData() {
    try {
      if (fs.existsSync(CONFIG.DATA_FILE)) {
        const raw = fs.readFileSync(CONFIG.DATA_FILE);
        jsonData = JSON.parse(raw);
        Logger.debug('データ読み込み完了');
      } else {
        Logger.warn('データファイル未存在、初期データ使用');
      }
    } catch (error) {
      Logger.error('データ読み込みエラー', error);
      jsonData = { rooms: {}, players: {}, logs: [] };
    }
  }

  static saveData(data = jsonData) {
    try {
      fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2));
      Logger.debug('データ保存完了');
    } catch (error) {
      Logger.error('データ保存エラー', error);
      throw error;
    }
  }

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

  static getPlayers() {
    this.loadData();
    return jsonData.players;
  }

  static updateSocketId(playerData) {
    this.loadData();
    if (jsonData.players[playerData.id]) {
      jsonData.players[playerData.id].socketId = playerData.socketid;
      this.saveData();
    }
  }

  static removePlayer(playerId) {
    this.loadData();
    if (jsonData.players[playerId]) {
      delete jsonData.players[playerId];
      this.saveData();
    }
  }

  static cleanupDuplicatePlayers() {
    DataManager.loadData();
    let hasChanges = false;
    
    for (const roomId in jsonData.rooms) {
      const room = jsonData.rooms[roomId];
      const originalLength = room.players.length;
      const uniquePlayers = [...new Set(room.players)];
      
      if (uniquePlayers.length !== originalLength) {
        Logger.info(`ルーム ${roomId} 重複除去: ${originalLength} → ${uniquePlayers.length}`);
        room.players = uniquePlayers;
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      DataManager.saveData();
      Logger.info('重複プレイヤークリーンアップ完了');
    } else {
      Logger.info('重複プレイヤーなし');
    }
  }

  static getJsonData() {
    return jsonData;
  }

  static setJsonData(data) {
    jsonData = data;
  }
}

module.exports = DataManager;