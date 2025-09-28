const { Game } = require('../public/src/game.js');
const { Player } = require('../public/src/player.js');
const { selectBestChoice } = require('../select.js');
const CONFIG = require('../config/config');
const Logger = require('../utils/logger');
const DataManager = require('../managers/dataManager');
const RoomManager = require('../managers/roomManager');

/**
 * ゲーム開始・終了・選択処理
 */
class GameService {
  static getName(roomId, index) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    const room = jsonData.rooms[roomId];
    if (room && room.players && room.players[index]) {
      const playerId = room.players[index];
      const player = jsonData.players[playerId];
      if (player) {
        Logger.debug(`getName: index=${index}, playerId=${playerId}, playerName=${player.name}`);
        return player.name;
      }
    }
    Logger.error(`getName: プレイヤーが見つかりません - roomId=${roomId}, index=${index}`);
    return `Unknown_${index}`;
  }

  static getName_cpu(roomId, index) {
    return `cpu_${index}`;
  }

  static async choice_cpu(now, choices, kind, socketId) {
    try {
      Logger.debug(`CPU選択: ${kind}`);

      const mlChoice = selectBestChoice(choices, now, kind);
      Logger.debug(`ML提案: ${mlChoice}`);

      if (GameService.isValidChoice(mlChoice, choices, kind)) {
        Logger.debug(`有効選択: ${mlChoice}`);
        return mlChoice;
      } else {
        Logger.warn(`無効選択: ${mlChoice}, フォールバック使用`);
        return GameService.getFallbackChoice(choices, kind, `invalid CPU response: ${mlChoice}`);
      }
    } catch (error) {
      Logger.error("CPU選択失敗:", error);
      return GameService.getFallbackChoice(choices, kind, `CPU error: ${error.message}`);
    }
  }

  static isValidChoice(choice, choices, kind) {
    Logger.debug(`=== isValidChoice Debug ===`);
    Logger.debug(`choice: ${choice} (type: ${typeof choice})`);
    Logger.debug(`choices: ${JSON.stringify(choices)}`);
    Logger.debug(`kind: ${kind}`);
    Logger.debug(`kind === OPPONENT_CHOICE: ${kind === CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE}`);
    Logger.debug(`OPPONENT_CHOICE value: ${CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE}`);
    
    if (choice === null || choice === undefined) {
      Logger.debug('choice is null or undefined');
      return false;
    }

    // opponentChoiceの特別な処理を先に行う
    if (kind === CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE) {
      Logger.debug('Processing opponentChoice validation...');
      // selectBestChoiceは文字列を返すため、数値に変換して比較
      const numChoice = Number(choice);
      Logger.debug(`opponentChoice検証: choice=${choice}, numChoice=${numChoice}, choices=${JSON.stringify(choices)}`);
      
      for (let i = 0; i < choices.length; i++) {
        const item = choices[i];
        Logger.debug(`checking item ${i}: selectNumber=${item.selectNumber}, player=${item.player}`);
        Logger.debug(`selectNumber === numChoice: ${item.selectNumber === numChoice}`);
        Logger.debug(`player === numChoice: ${item.player === numChoice}`);
      }
      
      const isValid = choices.some(item => item.selectNumber === numChoice || item.player === numChoice);
      Logger.debug(`opponentChoice検証結果: ${isValid}`);
      Logger.debug(`=== isValidChoice Debug End ===`);
      return isValid;
    }

    if (Array.isArray(choices)) {
      Logger.debug('choices is array, processing...');
      // selectBestChoiceは文字列を返すため、数値に変換して比較
      const numChoice = Number(choice);
      const result = choices.includes(numChoice);
      Logger.debug(`array validation result: ${result}`);
      return result;
    }

    Logger.debug('default return true');
    Logger.debug(`=== isValidChoice Debug End ===`);
    return true;
  }

  static getFallbackChoice(choices, kind, reason) {
    try {
      Logger.warn(`フォールバック選択: ${reason}`);

      if (kind === CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE && choices.length > 0) {
        const selectedNumber = choices[0].selectNumber;
        Logger.debug(`相手選択フォールバック: ${selectedNumber}`);
        return selectedNumber;
      }

      if (Array.isArray(choices) && choices.length > 0) {
        Logger.debug(`配列フォールバック: ${choices[0]}`);
        return choices[0];
      }

      Logger.warn('有効なフォールバック選択なし');
      return null;
    } catch (error) {
      Logger.error("フォールバック選択エラー:", error);
      return null;
    }
  }

  /**
   * SocketIDからRoomIDを取得
   * @param {string} socketId - ソケットID
   * @returns {string|null} ルームID
   */
  static getRoomIdFromSocketId(socketId) {
    const jsonData = DataManager.getJsonData();
    
    for (const roomId in jsonData.rooms) {
      const room = jsonData.rooms[roomId];
      for (const playerId of room.players) {
        if (jsonData.players[playerId] && jsonData.players[playerId].socketId === socketId) {
          return roomId;
        }
      }
    }
    return null;
  }

  /**
   * ゲームを開始
   * @param {string} roomId - ルームID
   * @param {Object} io - Socket.IOインスタンス
   * @param {Object} activeGames - アクティブゲーム管理オブジェクト
   * @returns {Promise} ゲーム結果
   */
  static async startGame(roomId, io, activeGames) {
    DataManager.loadData();
    const jsonData = DataManager.getJsonData();
    
    Logger.info(`ゲーム開始: ルーム ${roomId} のplaying状態をtrueに設定`);
    RoomManager.setRoomPlayingStatus(roomId, true);
    
    Logger.info('準備完了！ゲームを開始します');
    let socketIdList = [];
    
    for (let i = 0; i < jsonData.rooms[roomId].players.length; i++) {
      socketIdList.push(jsonData.players[jsonData.rooms[roomId].players[i]].socketId);
    }
    
    const gameData = { roomId: roomId, players: socketIdList };
    const playerCount = jsonData.rooms[roomId].players.length;
    
    // プレイヤー数に応じて関数配列を構築
    const funcs = [];
    
    if (playerCount === 1) {
      // CPU戦（1プレイヤー + 1CPU）
      Logger.info('CPU戦モードでゲーム開始');
      funcs.push({ get_name: GameService.getName, choice: GameService.createChoiceFunction(io) });
      funcs.push({ get_name: GameService.getName_cpu, choice: GameService.choice_cpu });
    } else {
      // マルチプレイヤー戦（全てプレイヤー）
      Logger.info(`${playerCount}プレイヤー戦モードでゲーム開始`);
      for (let i = 0; i < playerCount; i++) {
        funcs.push({ get_name: GameService.getName, choice: GameService.createChoiceFunction(io) });
      }
    }
    
    const game = new Game(playerCount === 1 ? 2 : playerCount, funcs, gameData, roomId);
    activeGames[roomId] = game;
    
    const result = await game.game();
    delete activeGames[roomId];
    
    return result;
  }

  /**
   * choice関数を作成
   * @param {Object} io - Socket.IOインスタンス
   * @returns {Function} choice関数
   */
  static createChoiceFunction(io) {
    return async (now, choices, kind, socketId) => {
      return GameService.handlePlayerChoice(now, choices, kind, socketId, io);
    };
  }

  /**
   * プレイヤーの選択処理
   * @param {Object} now - 現在のゲーム状態
   * @param {Array|Object} choices - 選択肢
   * @param {string} kind - 選択の種類
   * @param {string} socketId - ソケットID
   * @param {Object} io - Socket.IOインスタンス
   * @returns {Promise} 選択結果
   */
  static async handlePlayerChoice(now, choices, kind, socketId, io) {
    Logger.debug(`choice関数が呼び出されました: kind=${kind}, socketId=${socketId}`);
    Logger.debug('choices:', choices);

    try {
      const result = await GameService.emitWithAck(now, choices, kind, socketId, io);
      Logger.debug(`emitWithAckからの応答: ${result}`);

      if (GameService.isValidChoice(result, choices, kind)) {
        Logger.debug(`応答が有効: ${result}`);
        // opponentChoiceの場合、player値をselectNumberに変換
        if (kind === CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE) {
          const selectedItem = choices.find(item => item.player === Number(result));
          const finalResult = selectedItem ? selectedItem.selectNumber : result;
          Logger.debug(`最終選択: ${finalResult}`);
          Logger.debug(`emitWithAckの結果: ${finalResult}`);
          return finalResult;
        } else {
          Logger.debug(`最終選択: ${result}`);
          Logger.debug(`emitWithAckの結果: ${result}`);
          return result;
        }
      } else {
        Logger.warn(`応答が無効: ${result}, kind: ${kind}`);
        Logger.debug(`isValidChoice結果: false`);
        return GameService.getFallbackChoice(choices, kind, `invalid player response: ${result}`);
      }
    } catch (e) {
      Logger.error("choice (yourTurn) failed:", e);
      return GameService.getFallbackChoice(choices, kind, `player choice error: ${e.message}`);
    }
  }

  /**
   * Socket.IOでクライアントに選択を求め、応答を待つ
   * @param {Object} now - 現在のゲーム状態
   * @param {Array|Object} choices - 選択肢
   * @param {string} kind - 選択の種類
   * @param {string} socketId - 対象ソケットID
   * @param {Object} io - Socket.IOインスタンス
   * @returns {Promise} プレイヤーの選択結果
   */
  static emitWithAck(now, choices, kind, socketId, io) {
    return new Promise((resolve, reject) => {
      Logger.debug(`socketId: ${socketId}`);
      Logger.debug(`kind: ${kind}`);
      const util = require('util');
      Logger.debug('Choices:', util.inspect(choices, { depth: null }));
      
      io.timeout(CONFIG.SOCKET_TIMEOUT).to(socketId).emit('yourTurn', {now: now, choices: choices, kind: kind}, (err, responses) => {
        if (err) {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (!targetSocket) {
            Logger.debug(`既に切断済みのソケット (${socketId}) に対するタイムアウトのため、エラー処理をスキップ。`);
            return resolve(null); 
          }
          reject(err);
        } else {
          if (responses && responses.length > 0) {
            if (kind === CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE) {
              const playerChoice = choices[responses].player;
              Logger.debug(`responses: ${responses}`);
              Logger.debug(`playerChoice: ${playerChoice}`);
              resolve(playerChoice);
            } else {
              resolve(choices[responses[0]]);
            }
          } else {
            resolve(null);
          }
        }
      });
    });
  }
}

module.exports = GameService;