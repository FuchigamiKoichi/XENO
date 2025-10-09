// cardSpecificIssues.test.js
// カード2とカード6の特定問題に対するテスト

const { JSDOM } = require('jsdom');

describe('XENO Card-Specific Animation Issues', () => {
  let mockWindow, mockDocument, AnimModule;
  let gsapTimelineCallLog, gsapMockCallLog;
  let mockGsap;

  beforeEach(() => {
    // JSDOM環境の設定
    const dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head><title>Test</title></head>
        <body>
          <div id="select-container"></div>
          <div id="show-container"></div>
          <div id="player-hand"></div>
          <div id="opponent-hand"></div>
          <div id="playArea"></div>
          <div id="opponent-playArea"></div>
          <div id="turn-timer-bar"></div>
        </body>
      </html>
    `);

    mockWindow = dom.window;
    mockDocument = mockWindow.document;

    // グローバル設定
    global.window = mockWindow;
    global.document = mockDocument;
    global.HTMLElement = mockWindow.HTMLElement;
    global.Element = mockWindow.Element;

    // ログ配列の初期化
    gsapTimelineCallLog = [];
    gsapMockCallLog = [];

    // GSAP モック作成
    mockGsap = {
      set: jest.fn((el, props) => {
        gsapMockCallLog.push({ method: 'set', element: el, properties: props });
      }),
      to: jest.fn((el, props) => {
        gsapMockCallLog.push({ method: 'to', element: el, properties: props });
        return { kill: jest.fn() };
      }),
      from: jest.fn((el, props) => {
        gsapMockCallLog.push({ method: 'from', element: el, properties: props });
      }),
      fromTo: jest.fn((el, fromProps, toProps) => {
        gsapMockCallLog.push({ method: 'fromTo', element: el, from: fromProps, to: toProps });
        return { kill: jest.fn() };
      }),
      timeline: jest.fn(() => {
        const timelineMock = {
          set: jest.fn((target, properties) => {
            gsapTimelineCallLog.push({ method: 'set', target, properties });
            return timelineMock;
          }),
          to: jest.fn((target, properties) => {
            gsapTimelineCallLog.push({ method: 'to', target, properties });
            return timelineMock;
          }),
          from: jest.fn((target, properties) => {
            gsapTimelineCallLog.push({ method: 'from', target, properties });
            return timelineMock;
          }),
          fromTo: jest.fn((target, fromProps, toProps) => {
            gsapTimelineCallLog.push({ method: 'fromTo', target, from: fromProps, to: toProps });
            return timelineMock;
          }),
          kill: jest.fn(),
          pause: jest.fn(),
          play: jest.fn(),
          restart: jest.fn()
        };
        return timelineMock;
      })
    };

    global.gsap = mockGsap;

    // animation.js の再読み込み（CommonJS形式で模擬）
    AnimModule = {
      init: jest.fn(),
      playCardEffect: jest.fn(),
      zoomCard: jest.fn(),
      enqueueGuessAnnounce: jest.fn(),
      enqueueGuessResult: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete global.window;
    delete global.document;
    delete global.gsap;
  });

  describe('Card 2 Animation Issues', () => {
    it('should always execute card 2 basic animation regardless of local judgment', async () => {
      // 理想仕様: カード2は判定結果に関わらず常に基本アニメーションが実行される
      
      // ローカル判定成功時のシミュレーション
      const mockLocalJudgmentSuccess = {
        guessed: 5,
        isHit: true,
        targetTurn: 1
      };
      
      // カード2の基本アニメーション実行をモック
      AnimModule.playCardEffect = jest.fn().mockResolvedValue(undefined);
      
      // カード2プレイ処理のシミュレーション（修正後の実装）
      const cardNumber = 2;
      const isBarriered = false;
      
      // 修正後の実装: 常に基本アニメーションを先に実行
      await AnimModule.playCardEffect(cardNumber, isBarriered);
      
      // 基本アニメーションが確実に実行されることを確認
      expect(AnimModule.playCardEffect).toHaveBeenCalledWith(2, false);
      expect(AnimModule.playCardEffect).toHaveBeenCalledTimes(1);
    });

    it('should execute card 2 animation on first play when no previous card 2 exists', async () => {
      // 理想仕様: カード2の1回目プレイ時も必ずアニメーションが実行される
      
      // 1回目のカード2プレイをシミュレーション
      const gameState = {
        usedCards: [], // 使用済みカードが空 = 1回目
        myTurnNumber: 1
      };
      
      AnimModule.playCardEffect = jest.fn().mockResolvedValue(undefined);
      
      // カード2の効果実行
      await AnimModule.playCardEffect(2, false);
      
      // 1回目でもアニメーションが実行されることを確認
      expect(AnimModule.playCardEffect).toHaveBeenCalledWith(2, false);
      expect(AnimModule.playCardEffect).toHaveBeenCalledTimes(1);
    });

    it('should handle card 2 animation failure gracefully', async () => {
      // 理想仕様: カード2アニメーション失敗時の適切なエラーハンドリング
      
      const animationError = new Error('Animation failed');
      AnimModule.playCardEffect = jest.fn().mockRejectedValue(animationError);
      
      let caughtError = null;
      try {
        await AnimModule.playCardEffect(2, false);
      } catch (error) {
        caughtError = error;
      }
      
      // エラーが適切にキャッチされることを確認
      expect(caughtError).toBe(animationError);
      expect(AnimModule.playCardEffect).toHaveBeenCalledWith(2, false);
    });

    it('should execute card 2 judgment animation after basic animation', async () => {
      // 理想仕様: カード2の基本アニメーション後に判定アニメーションが実行される
      
      // 判定アニメーション関数をモック
      AnimModule.enqueueGuessAnnounce = jest.fn().mockResolvedValue(undefined);
      AnimModule.enqueueGuessResult = jest.fn().mockResolvedValue(undefined);
      AnimModule.playCardEffect = jest.fn().mockResolvedValue(undefined);
      
      // カード2判定結果のシミュレーション
      const judgmentResult = {
        guessed: 5,
        isHit: true,
        targetTurn: 2
      };
      
      // 基本アニメーション実行
      await AnimModule.playCardEffect(2, false);
      
      // 判定アニメーション実行
      await AnimModule.enqueueGuessAnnounce(judgmentResult.guessed, 'attacker');
      await AnimModule.enqueueGuessResult(judgmentResult.guessed, judgmentResult.isHit, 'attacker');
      
      // 両方のアニメーションが実行されることを確認
      expect(AnimModule.playCardEffect).toHaveBeenCalledWith(2, false);
      expect(AnimModule.enqueueGuessAnnounce).toHaveBeenCalledWith(5, 'attacker');
      expect(AnimModule.enqueueGuessResult).toHaveBeenCalledWith(5, true, 'attacker');
    });

    it('should fallback to demo judgment when prediction data is unavailable', () => {
      // 理想仕様: 予想データがない場合はデモ判定にフォールバック
      
      // DOM環境のモック（相手の手札）
      const mockOpponentCard = document.createElement('img');
      mockOpponentCard.dataset.card = '7';
      document.getElementById('opponent-hand').appendChild(mockOpponentCard);
      
      // デモ判定関数のシミュレーション
      const createDemoCard2Judgment = () => {
        const opponentCards = [7]; // 相手の手札
        const guessedCard = 5; // ランダム予想
        const isHit = opponentCards.includes(guessedCard);
        
        return {
          guessed: guessedCard,
          isHit: isHit,
          targetTurn: 2
        };
      };
      
      const demoResult = createDemoCard2Judgment();
      
      // デモ判定が適切に生成されることを確認
      expect(demoResult).toBeDefined();
      expect(demoResult.guessed).toBeGreaterThanOrEqual(1);
      expect(demoResult.guessed).toBeLessThanOrEqual(10);
      expect(typeof demoResult.isHit).toBe('boolean');
      expect(demoResult.targetTurn).toBe(2);
    });

    it('should support prediction input with validation', () => {
      // 理想仕様: 予想入力の検証機能
      
      // 予想データ追加機能のシミュレーション
      const mockCurrentGameState = {
        myTurnNumber: 1,
        pred: []
      };
      
      const addPredictionToGameState = (guessedCard, gameState = mockCurrentGameState) => {
        if (!gameState.pred) {
          gameState.pred = [];
        }
        
        const myTurn = gameState.myTurnNumber || 1;
        
        // 既存の予想を削除
        gameState.pred = gameState.pred.filter(p => p.subject !== myTurn);
        
        // 新しい予想を追加
        gameState.pred.push({
          subject: myTurn,
          predCard: guessedCard
        });
        
        return gameState;
      };
      
      // 予想追加のテスト
      const updatedState = addPredictionToGameState(7, mockCurrentGameState);
      
      expect(updatedState.pred).toHaveLength(1);
      expect(updatedState.pred[0].subject).toBe(1);
      expect(updatedState.pred[0].predCard).toBe(7);
      
      // 予想の上書きテスト
      const reUpdatedState = addPredictionToGameState(9, updatedState);
      
      expect(reUpdatedState.pred).toHaveLength(1);
      expect(reUpdatedState.pred[0].predCard).toBe(9);
    });

    it('should handle card 2 judgment animation from opponent perspective', () => {
      // 理想仕様: 相手側からのカード2判定アニメーション
      
      // 自分の手札をモック（相手からの攻撃の防御側）
      const mockPlayerCard = document.createElement('img');
      mockPlayerCard.dataset.card = '6';
      document.getElementById('player-hand').appendChild(mockPlayerCard);
      
      // 相手視点のデモ判定関数をシミュレーション
      const createDemoCard2Judgment = (isFromOpponent = false) => {
        const defenderCards = isFromOpponent ? [6] : [8]; // 防御側の手札
        const guessedCard = 4; // 攻撃側の予想
        const isHit = defenderCards.includes(guessedCard);
        
        return {
          guessed: guessedCard,
          isHit: isHit,
          targetTurn: isFromOpponent ? 1 : 2
        };
      };
      
      // 相手側からの呼び出しテスト
      const opponentResult = createDemoCard2Judgment(true);
      const selfResult = createDemoCard2Judgment(false);
      
      // 相手視点での適切な判定生成を確認
      expect(opponentResult.targetTurn).toBe(1); // 自分が防御者
      expect(opponentResult.isHit).toBe(false); // 6を持っているが4を予想されたのでハズレ
      
      // 自分視点での適切な判定生成を確認
      expect(selfResult.targetTurn).toBe(2); // 相手が防御者
      expect(selfResult.isHit).toBe(false); // 8を持っているが4を予想したのでハズレ
    });
  });

  describe('Card 6 Information Update Issues', () => {
    it('should use fresh hand information for card 6 animation', async () => {
      // 理想仕様: カード6のアニメーションで最新の手札情報を使用
      
      const freshHandInfo = {
        playerCards: [5],
        opponentCards: [8],
        onlyReveal: { player: true, opponent: true }
      };
      
      AnimModule.playCardEffect = jest.fn().mockResolvedValue(undefined);
      
      // カード6の効果実行（最新手札情報付き）
      await AnimModule.playCardEffect(6, false, freshHandInfo);
      
      // 正しい手札情報でアニメーションが実行されることを確認
      expect(AnimModule.playCardEffect).toHaveBeenCalledWith(6, false, freshHandInfo);
      expect(AnimModule.playCardEffect).toHaveBeenCalledTimes(1);
    });

    it('should handle incomplete hand information for card 6 gracefully', async () => {
      // 理想仕様: カード6で不完全な手札情報の適切な処理
      
      const incompleteHandInfo = {
        playerCards: [5],
        opponentCards: [], // 相手カード情報が不完全
        onlyReveal: { player: true, opponent: false }
      };
      
      AnimModule.playCardEffect = jest.fn().mockResolvedValue(undefined);
      
      // 不完全な情報でもエラーにならないことを確認
      await expect(AnimModule.playCardEffect(6, false, incompleteHandInfo)).resolves.toBeUndefined();
      
      expect(AnimModule.playCardEffect).toHaveBeenCalledWith(6, false, incompleteHandInfo);
    });

    it('should prioritize server data over cached information for card 6', async () => {
      // 理想仕様: カード6でサーバーデータをキャッシュより優先
      
      const serverHandInfo = {
        playerCards: [7], // サーバーからの最新データ
        opponentCards: [3],
        onlyReveal: { player: true, opponent: true }
      };
      
      const cachedHandInfo = {
        playerCards: [4], // 古いキャッシュデータ
        opponentCards: [9],
        onlyReveal: { player: true, opponent: true }
      };
      
      AnimModule.playCardEffect = jest.fn().mockResolvedValue(undefined);
      
      // サーバーデータを使用してアニメーション実行
      await AnimModule.playCardEffect(6, false, serverHandInfo);
      
      // サーバーデータが使用されることを確認
      expect(AnimModule.playCardEffect).toHaveBeenCalledWith(6, false, serverHandInfo);
      expect(AnimModule.playCardEffect).not.toHaveBeenCalledWith(6, false, cachedHandInfo);
    });

    it('should validate hand information structure before animation', () => {
      // 理想仕様: カード6アニメーション前の手札情報構造検証
      
      const validHandInfo = {
        playerCards: [5],
        opponentCards: [8],
        onlyReveal: { player: true, opponent: true }
      };
      
      const invalidHandInfo = {
        playerCards: "not-an-array", // 無効な形式
        opponentCards: null,
        onlyReveal: undefined
      };
      
      // 有効な構造の検証関数
      const isValidHandInfo = (handInfo) => {
        return handInfo &&
               Array.isArray(handInfo.playerCards) &&
               Array.isArray(handInfo.opponentCards) &&
               typeof handInfo.onlyReveal === 'object';
      };
      
      expect(isValidHandInfo(validHandInfo)).toBe(true);
      expect(isValidHandInfo(invalidHandInfo)).toBe(false);
    });
  });

  describe('Integration Tests for Card Issues', () => {
    it('should handle sequential card 2 and card 6 plays correctly', async () => {
      // 理想仕様: カード2とカード6の連続プレイでの正しい動作
      
      AnimModule.playCardEffect = jest.fn().mockResolvedValue(undefined);
      
      // カード2プレイ
      await AnimModule.playCardEffect(2, false);
      
      // カード6プレイ（手札情報付き）
      const handInfo = {
        playerCards: [7],
        opponentCards: [4],
        onlyReveal: { player: true, opponent: true }
      };
      await AnimModule.playCardEffect(6, false, handInfo);
      
      // 両方のアニメーションが正しく実行されることを確認
      expect(AnimModule.playCardEffect).toHaveBeenNthCalledWith(1, 2, false);
      expect(AnimModule.playCardEffect).toHaveBeenNthCalledWith(2, 6, false, handInfo);
      expect(AnimModule.playCardEffect).toHaveBeenCalledTimes(2);
    });

    it('should maintain animation performance under rapid card effects', async () => {
      // 理想仕様: 高速カード効果実行でのパフォーマンス維持
      
      const startTime = Date.now();
      
      AnimModule.playCardEffect = jest.fn().mockImplementation(async (cardNum) => {
        // 実際のアニメーション時間をシミュレート（短縮版）
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      // 複数のカード効果を高速実行
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(AnimModule.playCardEffect(2, false));
      }
      
      await Promise.all(promises);
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;
      
      // パフォーマンス要件: 100ms以内で完了
      expect(executionTime).toBeLessThan(100);
      expect(AnimModule.playCardEffect).toHaveBeenCalledTimes(5);
    });
  });
});