// messages.js - 文言管理クラス
class MessageManager {
  constructor() {
    this.messages = null;
    this.isLoaded = false;
  }

  // JSONファイルから文言を読み込み
  async loadMessages() {
    if (this.isLoaded) return;
    
    try {
      const response = await fetch('./messages.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.messages = await response.json();
      this.isLoaded = true;
      console.log('メッセージファイルを読み込みました');
    } catch (error) {
      console.error('メッセージファイルの読み込みに失敗しました:', error);
      // フォールバック用の基本メッセージ
      this.messages = this.getDefaultMessages();
      this.isLoaded = true;
    }
  }

  // フォールバック用のデフォルトメッセージ
  getDefaultMessages() {
    return {
      cards: {},
      game: {
        deckCount: "残り枚数: {count}",
        yourTurn: "あなたのターンです",
        opponentTurn: "相手のターンです"
      },
      select: {
        default: "カードを選択してください"
      },
      effects: {
        default: "効果は特にありません。"
      },
      ui: {
        clickHint: "クリック"
      }
    };
  }

  // カード情報を取得
  getCardInfo(cardNumber) {
    if (!this.isLoaded || !this.messages.cards) {
      return { name: '不明', effect: '効果は特にありません。' };
    }
    
    const cardInfo = this.messages.cards[cardNumber.toString()];
    return cardInfo || { name: '不明', effect: '効果は特にありません。' };
  }

  // 選択画面のメッセージを取得
  getSelectMessage(kind) {
    if (!this.isLoaded || !this.messages.select) {
      return 'カードを選択してください';
    }
    
    return this.messages.select[kind] || this.messages.select.default;
  }

  // ゲーム内メッセージを取得（プレースホルダー置換対応）
  getGameMessage(key, replacements = {}) {
    if (!this.isLoaded || !this.messages.game) {
      return key;
    }
    
    let message = this.messages.game[key] || key;
    
    // プレースホルダーを置換
    Object.keys(replacements).forEach(placeholder => {
      message = message.replace(`{${placeholder}}`, replacements[placeholder]);
    });
    
    return message;
  }

  // エフェクトメッセージを取得
  getEffectMessage(characterName) {
    if (!this.isLoaded || !this.messages.effects) {
      return '効果は特にありません。';
    }
    
    return this.messages.effects[characterName] || this.messages.effects.default;
  }

  // UIメッセージを取得
  getUIMessage(key, replacements = {}) {
    if (!this.isLoaded || !this.messages.ui) {
      return key;
    }
    
    // ネストされたキーに対応（例: "tooltip.selectCard"）
    const keys = key.split('.');
    let message = keys.reduce((obj, k) => obj?.[k], this.messages.ui);
    
    if (typeof message !== 'string') {
      return key;
    }
    
    // プレースホルダーを置換
    Object.keys(replacements).forEach(placeholder => {
      message = message.replace(`{${placeholder}}`, replacements[placeholder]);
    });
    
    return message;
  }
}

// グローバルインスタンスを作成
const messageManager = new MessageManager();

// 初期化関数
async function initializeMessages() {
  await messageManager.loadMessages();
}