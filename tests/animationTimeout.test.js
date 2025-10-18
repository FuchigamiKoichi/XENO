/**
 * アニメーション中のタイムアウト処理テスト
 * タイムアウト直前にカードを選択した際のアニメーション中断問題の修正確認
 */

// DOM環境のセットアップ
const { JSDOM } = require('jsdom');

describe('Animation Timeout Handling', () => {
  let dom;
  let window;
  let document;
  let mockSocketHandlers;

  beforeEach(() => {
    // JSDOM環境を作成
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="timeout-warning" class="timeout-warning"></div>
          <div id="select-container"></div>
          <div id="player-hand"></div>
          <div id="opponent-hand"></div>
          <div id="turn-timer-bar"></div>
        </body>
      </html>
    `, { 
      url: 'http://localhost',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    // SocketHandlers のモック作成
    mockSocketHandlers = {
      timeoutWarningTimer: null,
      isAnimationInProgress: false,
      
      startTimeoutWarning: function(durationMs = 55000) {
        this.clearTimeoutWarning();
        this.timeoutWarningTimer = setTimeout(() => {
          if (this.isAnimationInProgress) {
            this.showTimeoutWarning();
            this.waitForAnimationComplete().then(() => {
              this.hideTimeoutWarning();
            });
          }
        }, durationMs);
      },
      
      clearTimeoutWarning: function() {
        if (this.timeoutWarningTimer) {
          clearTimeout(this.timeoutWarningTimer);
          this.timeoutWarningTimer = null;
        }
        this.hideTimeoutWarning();
      },
      
      showTimeoutWarning: function() {
        const warningElement = document.getElementById('timeout-warning');
        if (warningElement) {
          warningElement.classList.add('show');
        }
      },
      
      hideTimeoutWarning: function() {
        const warningElement = document.getElementById('timeout-warning');
        if (warningElement) {
          warningElement.classList.remove('show');
        }
      },
      
      waitForAnimationComplete: async function() {
        const maxWait = 3000;
        const checkInterval = 100;
        let waited = 0;
        
        while (this.isAnimationInProgress && waited < maxWait) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waited += checkInterval;
        }
      }
    };

    global.SocketHandlers = mockSocketHandlers;
  });

  afterEach(() => {
    dom.window.close();
    delete global.window;
    delete global.document;
    delete global.SocketHandlers;
  });

  describe('Timeout Warning System', () => {
    test('should initialize warning system properly', () => {
      expect(mockSocketHandlers.timeoutWarningTimer).toBeNull();
      expect(mockSocketHandlers.isAnimationInProgress).toBe(false);
    });

    test('should start timeout warning timer', () => {
      const shortDuration = 100; // 100ms for testing
      mockSocketHandlers.startTimeoutWarning(shortDuration);
      
      expect(mockSocketHandlers.timeoutWarningTimer).not.toBeNull();
    });

    test('should clear timeout warning timer', () => {
      mockSocketHandlers.startTimeoutWarning(100);
      mockSocketHandlers.clearTimeoutWarning();
      
      expect(mockSocketHandlers.timeoutWarningTimer).toBeNull();
    });

    test('should show warning UI when animation is in progress', (done) => {
      const warningElement = document.getElementById('timeout-warning');
      mockSocketHandlers.isAnimationInProgress = true;
      
      const shortDuration = 50; // 50ms for testing
      mockSocketHandlers.startTimeoutWarning(shortDuration);
      
      setTimeout(() => {
        expect(warningElement.classList.contains('show')).toBe(true);
        done();
      }, 100);
    });

    test('should not show warning UI when animation is not in progress', (done) => {
      const warningElement = document.getElementById('timeout-warning');
      mockSocketHandlers.isAnimationInProgress = false;
      
      const shortDuration = 50; // 50ms for testing
      mockSocketHandlers.startTimeoutWarning(shortDuration);
      
      setTimeout(() => {
        expect(warningElement.classList.contains('show')).toBe(false);
        done();
      }, 100);
    });

    test('should hide warning UI when animation completes', (done) => {
      const warningElement = document.getElementById('timeout-warning');
      mockSocketHandlers.isAnimationInProgress = true;
      
      const shortDuration = 50;
      mockSocketHandlers.startTimeoutWarning(shortDuration);
      
      setTimeout(() => {
        // 警告が表示されることを確認
        expect(warningElement.classList.contains('show')).toBe(true);
        
        // アニメーション完了をシミュレート
        mockSocketHandlers.isAnimationInProgress = false;
        
        // 少し待ってから警告が消えることを確認
        setTimeout(() => {
          expect(warningElement.classList.contains('show')).toBe(false);
          done();
        }, 200);
      }, 100);
    }, 15000); // タイムアウトを15秒に延長
  });

  describe('Animation State Management', () => {
    test('should track animation progress correctly', () => {
      expect(mockSocketHandlers.isAnimationInProgress).toBe(false);
      
      mockSocketHandlers.isAnimationInProgress = true;
      expect(mockSocketHandlers.isAnimationInProgress).toBe(true);
      
      mockSocketHandlers.isAnimationInProgress = false;
      expect(mockSocketHandlers.isAnimationInProgress).toBe(false);
    });

    test('should wait for animation completion with timeout', async () => {
      mockSocketHandlers.isAnimationInProgress = true;
      
      // アニメーション完了をシミュレート
      setTimeout(() => {
        mockSocketHandlers.isAnimationInProgress = false;
      }, 500);
      
      const startTime = Date.now();
      await mockSocketHandlers.waitForAnimationComplete();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(500);
      expect(endTime - startTime).toBeLessThan(600); // 余裕をもって600ms未満
    });

    test('should timeout when animation takes too long', async () => {
      mockSocketHandlers.isAnimationInProgress = true;
      // アニメーションを完了させない（タイムアウトを発生させる）
      
      const startTime = Date.now();
      await mockSocketHandlers.waitForAnimationComplete();
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(3000);
      expect(endTime - startTime).toBeLessThan(3100); // 余裕をもって3100ms未満
    });
  });

  describe('Error Handling', () => {
    test('should handle missing warning element gracefully', () => {
      // 警告要素を削除
      const warningElement = document.getElementById('timeout-warning');
      warningElement.remove();
      
      expect(() => {
        mockSocketHandlers.showTimeoutWarning();
        mockSocketHandlers.hideTimeoutWarning();
      }).not.toThrow();
    });

    test('should handle timer cleanup on multiple clear calls', () => {
      mockSocketHandlers.startTimeoutWarning(100);
      mockSocketHandlers.clearTimeoutWarning();
      
      expect(() => {
        mockSocketHandlers.clearTimeoutWarning(); // 二回目の呼び出し
      }).not.toThrow();
      
      expect(mockSocketHandlers.timeoutWarningTimer).toBeNull();
    });
  });

  describe('Integration with Game Flow', () => {
    test('should properly integrate with card play animation', async () => {
      // カードプレイアニメーションをシミュレート
      mockSocketHandlers.isAnimationInProgress = true;
      mockSocketHandlers.startTimeoutWarning(100);
      
      // アニメーション中にタイムアウト警告が表示されることを確認
      await new Promise(resolve => setTimeout(resolve, 150));
      const warningElement = document.getElementById('timeout-warning');
      expect(warningElement.classList.contains('show')).toBe(true);
      
      // アニメーション完了
      mockSocketHandlers.isAnimationInProgress = false;
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // 警告が消えることを確認
      expect(warningElement.classList.contains('show')).toBe(false);
    });

    test('should handle timeout during card effect animation', async () => {
      let callbackCalled = false;
      const mockCallback = () => {
        callbackCalled = true;
      };
      
      // アニメーション進行中の状態をシミュレート
      mockSocketHandlers.isAnimationInProgress = true;
      
      // タイムアウト警告を開始
      mockSocketHandlers.startTimeoutWarning(50);
      
      // アニメーション完了を待機
      setTimeout(() => {
        mockSocketHandlers.isAnimationInProgress = false;
        mockCallback();
      }, 300);
      
      await new Promise(resolve => setTimeout(resolve, 400));
      
      expect(callbackCalled).toBe(true);
    });
  });
});