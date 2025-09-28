const CONFIG = require('./config/config');
const Logger = require('./utils/logger');
const DataManager = require('./managers/dataManager');
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

server.listen(CONFIG.PORT, () => {
  Logger.info(`サーバ起動: ポート ${CONFIG.PORT}`);
  Logger.info('重複プレイヤークリーンアップ実行中...');
  DataManager.cleanupDuplicatePlayers();
});
