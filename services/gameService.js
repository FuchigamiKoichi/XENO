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

  static async choice_cpu(now, choices, kind, socketId, io) {
    try {
      Logger.debug(`CPU選択: ${kind}`);

      const mlChoice = selectBestChoice(choices, now, kind);
      Logger.debug(`ML提案: ${mlChoice}`);

      let finalChoice;
      if (GameService.isValidChoice(mlChoice, choices, kind)) {
        Logger.debug(`有効選択: ${mlChoice}`);
        finalChoice = mlChoice;
      } else {
        Logger.warn(`無効選択: ${mlChoice}, フォールバック使用`);
        finalChoice = GameService.getFallbackChoice(choices, kind, `invalid CPU response: ${mlChoice}`);
      }
      
      // カードプレイ、可視更新、予想処理、カード捨て処理は他のプレイヤーに通知
      if ((kind === 'play_card' || kind === 'update' || kind === 'pred' || kind === 'trush' || kind === 'trash') && io) {
        GameService.notifyOtherPlayers(now, choices, finalChoice, kind, socketId, io);
      }
      
      return finalChoice;
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
    
    // update はUI反映用の通知であり検証不要（オブジェクトpayloadをそのまま返す）
    if (kind === CONFIG.GAME_RULES.CHOICE_TYPES.UPDATE) {
      Logger.debug('kind=update: always valid');
      return true;
    }
    
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
    let playerIdList = [];
    
    for (let i = 0; i < jsonData.rooms[roomId].players.length; i++) {
      const playerId = jsonData.rooms[roomId].players[i];
      playerIdList.push(playerId);
      socketIdList.push(jsonData.players[playerId].socketId);
    }
    
    const gameData = { 
      roomId: roomId, 
      players: socketIdList, 
      playerIds: playerIdList 
    };
    const playerCount = jsonData.rooms[roomId].players.length;
    
    // プレイヤー数に応じて関数配列を構築
    const funcs = [];
    
    if (playerCount === 1) {
      // CPU戦（1プレイヤー + 1CPU）
      Logger.info('CPU戦モードでゲーム開始');
      funcs.push({ get_name: GameService.getName, choice: GameService.createChoiceFunction(io) });
      funcs.push({ get_name: GameService.getName_cpu, choice: GameService.createCpuChoiceFunction(io) });
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
   * CPU用choice関数を作成
   * @param {Object} io - Socket.IOインスタンス
   * @returns {Function} CPU choice関数
   */
  static createCpuChoiceFunction(io) {
    return async (now, choices, kind, socketId) => {
      return GameService.choice_cpu(now, choices, kind, socketId, io);
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
      const isBarriered = await GameService.checkIsBarrier(now);
      const result = await GameService.emitWithAck(now, choices, kind, socketId, io, isBarriered);
      Logger.debug(`emitWithAckからの応答: ${result}`);

      if (GameService.isValidChoice(result, choices, kind)) {
        Logger.debug(`応答が有効: ${result}`);
        
        let finalResult;
        // opponentChoiceの場合、player値をselectNumberに変換
        if (kind === CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE) {
          const selectedItem = choices.find(item => item.player === Number(result));
          finalResult = selectedItem ? selectedItem.selectNumber : result;
          Logger.debug(`最終選択: ${finalResult}`);
        } else {
          finalResult = result;
          Logger.debug(`最終選択: ${result}`);
        }
        
        // カードプレイ、可視更新、予想処理、カード捨て処理を他のプレイヤーに通知
        if (kind === 'play_card' || kind === 'update' || kind === 'pred' || kind === 'trash') {
          GameService.notifyOtherPlayers(now, choices, finalResult, kind, socketId, io);
        }
        
        Logger.debug(`emitWithAckの結果: ${finalResult}`);
        return finalResult;
      } else {
        Logger.warn(`応答が無効: ${result}, kind: ${kind}`);
        Logger.debug(`isValidChoice結果: false`);
        // update は無効扱いにせず、そのままブロードキャスト（UI更新用）
        if (kind === CONFIG.GAME_RULES.CHOICE_TYPES.UPDATE) {
          try {
            GameService.notifyOtherPlayers(now, choices, result ?? choices, kind, socketId, io);
          } catch (e) {}
          return result ?? choices;
        }
        return GameService.getFallbackChoice(choices, kind, `invalid player response: ${result}`);
      }
    } catch (e) {
      Logger.error("choice (yourTurn) failed:", e);
      
      // タイムアウトエラーの場合のみ、nullを返してゲーム側でタイムアウト処理を行わせる
      if (e.message && e.message.toLowerCase().includes('timeout')) {
        Logger.warn(`プレイヤー ${socketId} がタイムアウトしました`);
        return null;  // タイムアウト時はnullを返す
      }
      
      return GameService.getFallbackChoice(choices, kind, `player choice error: ${e.message}`);
    }
  }

  /**
   * 他のプレイヤーにアクションを通知
   * @param {Object} now - 現在のゲーム状態
   * @param {*} choice - プレイヤーの選択
   * @param {string} kind - アクションの種類
   * @param {string} actorSocketId - アクションを行ったプレイヤーのソケットID
   * @param {Object} io - Socket.IOインスタンス
   */
  static notifyOtherPlayers(now, choices, choice, kind, actorSocketId, io) {
    try {
      // ルームIDを取得（nowオブジェクトから）
      const roomId = now.roomId;
      if (!roomId) {
        Logger.warn('ルームIDが見つかりません。他のプレイヤーへの通知をスキップします。');
        return;
      }
      
      Logger.debug(`他のプレイヤーに通知: roomId=${roomId}, choice=${choice}, kind=${kind}, actor=${actorSocketId}`);
      
      // アクションを行ったプレイヤー以外に通知
      // バリア効果の判定（カード効果が無効化されるかどうか）
      let isBarriered = false;
      if (kind === 'play_card') {
        isBarriered = GameService.checkIsBarrier(now);
      }

      // カード6と2の場合、防御側が正しく処理できるように相手の手札情報を追加
      const enhancedNow = { ...now };
      if (kind === 'play_card' && (choice == 6 || choice == 2)) {
        try {
          // 攻撃者の手札情報を相手に送信
          const attackerTurn = now.myTurnNumber;
          if (attackerTurn && now.hands && now.hands[attackerTurn]) {
            enhancedNow.attackerHands = now.hands[attackerTurn];
            Logger.debug(`カード${choice}: 攻撃者の手札情報を追加`, enhancedNow.attackerHands);
          }
        } catch (e) {
          Logger.warn('攻撃者手札情報の追加に失敗:', e);
        }
      }
      
      // カード2の予想処理の場合、実際の予想カード情報を追加
      if (kind === 'pred') {
        try {
          // choiceは配列のインデックスなので、実際のカード番号に変換
          let guessedCard = choice;
          if (Array.isArray(choices) && typeof choice === 'number' && choice >= 0 && choice < choices.length) {
            guessedCard = choices[choice];
          }
          enhancedNow.guessedCard = parseInt(guessedCard, 10);
          Logger.debug(`カード2予想: 予想カード${guessedCard}を防御側に送信`);
        } catch (e) {
          Logger.warn('予想カード情報の追加に失敗:', e);
        }
      }

      const notificationData = {
        choices: choices,
        choice: choice,
        kind: kind,
        now: enhancedNow,
        isBarriered: isBarriered
      };
      
      // ルーム内の他のプレイヤーに anotherTurn イベントを送信
      io.to(roomId).except(actorSocketId).emit('anotherTurn', notificationData);
      

      
      Logger.debug('他のプレイヤーへの通知完了');
    } catch (error) {
      Logger.error('他のプレイヤーへの通知中にエラーが発生:', error);
    }
  }

  /**
   * Socket.IOのACKレスポンスを正規化して選択値を取り出す
   * - UPDATE: クライアントのpayloadをそのまま返す（なければchoices）
   * - OPPONENT_CHOICE: インデックスから choices[idx].player を返す（または直接値を数値化）
   * - その他: インデックスから choices[idx] を返す（または直接値）
   */
  static parseAckResponse(choices, kind, responses) {
    try {
      const first = Array.isArray(responses) ? responses[0] : responses;

      if (kind === CONFIG.GAME_RULES.CHOICE_TYPES.UPDATE) {
        return typeof first === 'undefined' || first === null ? choices : first;
      }

      if (Array.isArray(choices)) {
        const idx = Number(first);
        // インデックスの場合
        if (!Number.isNaN(idx) && idx >= 0 && idx < choices.length) {
          if (kind === CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE) {
            // 相手プレイヤー指定の候補: { selectNumber, player }
            const item = choices[idx];
            if (item && Object.prototype.hasOwnProperty.call(item, 'player')) {
              return item.player;
            }
          }
          return choices[idx];
        }
        // 直接値が返ってきた場合（フォールバック）
        return first;
      }

      // choicesが配列でない場合（例: UPDATEなど）
      return first;
    } catch (e) {
      Logger.error('parseAckResponse中にエラー:', e);
      return null;
    }
  }

  /**
   * バリア効果（カード効果無効化）を判定する
   * @param {Object} gameState - 現在のゲーム状態
   * @returns {boolean} バリア効果が発動するかどうか
   */
  static checkIsBarrier(gameState) {
  // 他プレイヤーを対象とするカードの一覧
  // 6(貴族)は相手の手札を公開するためバリア対象に含める
  // const targetingCards = [1, 2, 3, 5, 6, 8, 9, 10];

  // if (!targetingCards.includes(parseInt(cardNumber))) {
  //   return false;
  // }
  
  // ゲーム状態から対象プレイヤーのaffected状態を確認
  try {
    // 対象プレイヤー（効果を受ける側）のaffected状態をチェック
    const otherPlayersKeys = Object.keys(gameState.otherPlayers || {});
    const playerData = gameState.otherPlayers[otherPlayersKeys[0]];
    if (playerData && playerData.affected === false) {
      Logger.debug(`相手（ターン${otherPlayersKeys[0]}）はバリアの効果が発動します`)
      return true;
    }
    // for (const turnNumber of otherPlayersKeys) {
    //   const playerData = gameState.otherPlayers[turnNumber];
      
    //   // affected = false の場合、バリア効果発動
    //   if (playerData && playerData.affected === false) {
    //     Logger.debug(`バリア効果発動: ターン${turnNumber}のプレイヤーはaffected=false状態`);
    //     return true;
    //   }
    // }
    
    return false;
  } catch (error) {
    Logger.error('バリア効果判定中にエラー:', error);
    return false;
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
  static emitWithAck(now, choices, kind, socketId, io, isBarriered) {
    return new Promise((resolve, reject) => {
      Logger.debug(`socketId: ${socketId}`);
      Logger.debug(`kind: ${kind}`);
      const util = require('util');
      Logger.debug('Choices:', util.inspect(choices, { depth: null }));
      
      io.timeout(CONFIG.SOCKET_TIMEOUT).to(socketId).emit('yourTurn', {now: now, choices: choices, kind: kind, isBarriered: isBarriered}, (err, responses) => {
        if (err) {
          const targetSocket = io.sockets.sockets.get(socketId);
          if (!targetSocket) {
            Logger.debug(`既に切断済みのソケット (${socketId}) に対するタイムアウトのため、エラー処理をスキップ。`);
            return resolve(null); 
          }
          // タイムアウトエラーの場合、エラーメッセージを明確にする
          const timeoutError = new Error(`timeout: ${err.message}`);
          reject(timeoutError);
        } else {
          const value = GameService.parseAckResponse(choices, kind, responses);
          Logger.debug(`ACK正規化結果: ${util.inspect(value, { depth: null })}`);
          resolve(typeof value === 'undefined' ? null : value);
        }
      });
    });
  }
}

module.exports = GameService;