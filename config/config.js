/**
 * アプリケーション設定定数
 * サーバー設定、ゲームルール、ログレベルなどを一元管理
 */

const CONFIG = {
  // サーバー設定
  PORT: 3000,
  DATA_FILE: './data.json',
  MIN_PLAYERS_PER_ROOM: 2,  // 理想仕様: 最小2人プレイ
  MAX_PLAYERS_PER_ROOM: 2,  // 理想仕様: 最大2人プレイ（テスト仕様準拠）
  SOCKET_TIMEOUT: 5 * 60000, // 理想仕様: 5分制限時間（テスト仕様準拠）

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