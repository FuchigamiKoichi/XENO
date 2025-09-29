const CONFIG = require('./config/config');
const Logger = require('./utils/logger');
const DataManager = require('./managers/dataManager');
const RoomManager = require('./managers/roomManager');
const SocketHandlers = require('./handlers/socketHandlers');

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const activeGames = {};
const pendingChoices = {};

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));
SocketHandlers.setupHandlers(io, activeGames, pendingChoices);

// 定期的なルームクリーンアップ（30分ごと）
setInterval(() => {
  Logger.info('定期ルームクリーンアップ開始');
  
  // 空ルームの削除
  RoomManager.cleanupEmptyRooms();
  
  // 24時間以上非アクティブなルームの削除
  RoomManager.cleanupInactiveRooms(24);
  
  Logger.info('定期ルームクリーンアップ完了');
}, 30 * 60 * 1000); // 30分

server.listen(CONFIG.PORT, () => {
  Logger.info(`サーバ起動: ポート ${CONFIG.PORT}`);
  Logger.info('重複プレイヤークリーンアップ実行中...');
  DataManager.cleanupDuplicatePlayers();
  
  // サーバー起動時の初回クリーンアップ
  setTimeout(() => {
    Logger.info('起動時ルームクリーンアップ実行');
    RoomManager.cleanupEmptyRooms();
    RoomManager.cleanupInactiveRooms(24);
  }, 5000); // 起動5秒後
});
