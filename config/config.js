/**
 * アプリケーション設定定数
 * サーバー設定、ゲームルール、ログレベルなどを一元管理
 */

const CONFIG = {
  // サーバー設定
  PORT: 3000,
  DATA_FILE: './data.json',
  MAX_PLAYERS_PER_ROOM: 2,
  SOCKET_TIMEOUT: 5 * 60000, // 5分

  // ゲームルール
  GAME_RULES: {
    CARDS: {
      HERO: 10,
      MIN_CARD: 1,
      MAX_CARD: 10
    },
    CHOICE_TYPES: {
      PLAY_CARD: 'play_card',
      OPPONENT_CHOICE: 'opponentChoice',
      PREDICTION: 'pred',
      TRASH: 'trush',
      UPDATE: 'update'
    },
    RESTRICTIONS: {
      HERO_UNPLAYABLE: 'カード10（英雄）は通常のプレイでは選択できません'
    }
  },

  // ログレベル
  LOG_LEVELS: {
    ERROR: 'ERROR',
    WARN: 'WARN', 
    INFO: 'INFO',
    DEBUG: 'DEBUG'
  }
};

module.exports = CONFIG;