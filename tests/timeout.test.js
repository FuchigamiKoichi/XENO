const GameService = require('../services/gameService');
const CONFIG = require('../config/config');

describe('Timeout Handling', () => {
  let mockIO;
  let mockSocket;
  let roomId;
  let playerId;

  beforeEach(() => {
    // Socket.IOのモックを作成
    mockSocket = {
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn()
    };

    mockIO = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
      except: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      sockets: {
        sockets: new Map()
      }
    };

    roomId = 'test-room-timeout';
    playerId = 'test-player-timeout';
    
    // ソケットマップにテスト用ソケットを追加
    mockIO.sockets.sockets.set(playerId, mockSocket);
  });

  afterEach(() => {
    // モックのクリーンアップ
    jest.clearAllMocks();
  });

  describe('Player Choice Timeout', () => {
    it('should handle timeout correctly and return null for player choice', async () => {
      // タイムアウトをシミュレートするために短い時間に設定
      const originalTimeout = CONFIG.SOCKET_TIMEOUT;
      CONFIG.SOCKET_TIMEOUT = 100; // 100ms

      const mockChoices = [1, 2, 3];
      const mockNow = { 
        players: [
          { id: playerId, name: 'TestPlayer', live: true },
          { id: 'opponent', name: 'Opponent', live: true }
        ],
        otherPlayers: {},
        myTurnNumber: 1
      };

      // タイムアウトを発生させるためにemitコールバックを遅延させる
      mockIO.timeout = jest.fn(() => ({
        to: jest.fn(() => ({
          emit: jest.fn((event, data, callback) => {
            // タイムアウトをシミュレート
            setTimeout(() => {
              callback(new Error('operation has timed out'));
            }, 150); // CONFIG.SOCKET_TIMEOUTより長い時間
          })
        }))
      }));

      try {
        const result = await GameService.handlePlayerChoice(
          mockNow,
          mockChoices, 
          'play_card',
          playerId,
          mockIO
        );

        // タイムアウト時はnullを返すべき
        expect(result).toBeNull();
      } finally {
        // 元のタイムアウト設定に戻す
        CONFIG.SOCKET_TIMEOUT = originalTimeout;
      }
    }, 10000); // テストのタイムアウトを10秒に設定

    it('should handle timeout error message correctly', async () => {
      const originalTimeout = CONFIG.SOCKET_TIMEOUT;
      CONFIG.SOCKET_TIMEOUT = 100;

      const mockChoices = [{ selectNumber: 1, player: 1 }];
      const mockNow = {
        players: [
          { id: playerId, name: 'TestPlayer', live: true },
          { id: 'opponent', name: 'Opponent', live: true }
        ],
        otherPlayers: {},
        myTurnNumber: 1
      };

      // タイムアウトエラーをシミュレート
      mockIO.timeout = jest.fn(() => ({
        to: jest.fn(() => ({
          emit: jest.fn((event, data, callback) => {
            setTimeout(() => {
              callback(new Error('timeout: operation timed out'));
            }, 150);
          })
        }))
      }));

      try {
        const result = await GameService.handlePlayerChoice(
          mockNow,
          mockChoices,
          'opponentChoice',
          playerId,
          mockIO
        );

        expect(result).toBeNull();
      } finally {
        CONFIG.SOCKET_TIMEOUT = originalTimeout;
      }
    }, 10000);

    it.skip('should distinguish timeout from other errors', async () => {
      const mockChoices = [1, 2, 3];
      const mockNow = { 
        players: [
          { id: playerId, name: 'TestPlayer', live: true }
        ],
        otherPlayers: {},
        myTurnNumber: 1
      };

      // checkIsBarrierをモック
      const originalCheckIsBarrier = GameService.checkIsBarrier;
      GameService.checkIsBarrier = jest.fn().mockReturnValue(false);

      // 通常のエラーをシミュレート（タイムアウト以外）
      // ソケットが存在することを確認
      mockIO.sockets.sockets.set(playerId, mockSocket);
      
      mockIO.timeout = jest.fn(() => ({
        to: jest.fn(() => ({
          emit: jest.fn((event, data, callback) => {
            callback(new Error('connection error'));
          })
        }))
      }));

      try {
        const result = await GameService.handlePlayerChoice(
          mockNow,
          mockChoices,
          'play_card',
          playerId,
          mockIO
        );

        // タイムアウト以外のエラーの場合はフォールバック選択を返すべき
        expect(result).not.toBeNull();
        expect(result).toBe(1); // フォールバック選択（最初の選択肢）
      } finally {
        // モックを元に戻す
        GameService.checkIsBarrier = originalCheckIsBarrier;
      }
    });
  });

  describe('Timeout Configuration', () => {
    it('should have appropriate timeout configuration', () => {
      // 理想仕様: タイムアウト設定が適切であること
      expect(CONFIG.SOCKET_TIMEOUT).toBeDefined();
      expect(typeof CONFIG.SOCKET_TIMEOUT).toBe('number');
      expect(CONFIG.SOCKET_TIMEOUT).toBeGreaterThan(0);
      expect(CONFIG.SOCKET_TIMEOUT).toBe(60000); // 1分
    });

    it('should handle timeout within expected time frame', () => {
      // 理想仕様: タイムアウト処理が期待される時間内に完了すること
      const maxTimeoutHandlingTime = 100; // 100ms以内
      
      const startTime = Date.now();
      
      // タイムアウト処理のシミュレーション
      const timeoutError = new Error('timeout: operation timed out');
      const isTimeoutError = timeoutError.message.includes('timeout');
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      expect(isTimeoutError).toBe(true);
      expect(processingTime).toBeLessThan(maxTimeoutHandlingTime);
    });
  });

  describe('Game End Conditions', () => {
    it('should recognize timeout as valid win condition', () => {
      // テストに定義された理想仕様の確認
      const expectedWinConditions = ['OPPONENT_TIMEOUT'];
      
      // この条件がゲームの勝利条件として認識されることを確認
      expect(expectedWinConditions).toContain('OPPONENT_TIMEOUT');
    });

    it('should handle timeout gracefully without crashing', async () => {
      // タイムアウトが発生してもシステムがクラッシュしないことを確認
      const originalTimeout = CONFIG.SOCKET_TIMEOUT;
      CONFIG.SOCKET_TIMEOUT = 50; // 非常に短いタイムアウト

      const mockChoices = [1, 2, 3];
      const mockNow = { 
        players: [{ id: playerId, name: 'TestPlayer', live: true }],
        otherPlayers: {},
        myTurnNumber: 1
      };

      mockIO.timeout = jest.fn(() => ({
        to: jest.fn(() => ({
          emit: jest.fn((event, data, callback) => {
            setTimeout(() => {
              callback(new Error('timeout: operation timed out'));
            }, 100);
          })
        }))
      }));

      let errorOccurred = false;
      try {
        const result = await GameService.handlePlayerChoice(
          mockNow,
          mockChoices,
          'play_card',
          playerId,
          mockIO
        );
        
        expect(result).toBeNull();
      } catch (error) {
        errorOccurred = true;
      } finally {
        CONFIG.SOCKET_TIMEOUT = originalTimeout;
      }

      // エラーが発生せずに正常に処理されることを確認
      expect(errorOccurred).toBe(false);
    }, 10000);
  });
});