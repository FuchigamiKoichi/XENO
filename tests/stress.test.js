const GameService = require('../services/gameService');
const SocketHandlers = require('../handlers/socketHandlers');
const CONFIG = require('../config/config');

// Stress test for edge cases that might reveal function bugs
describe('Stress Tests - Function Validation', () => {
  describe('GameService Stress Tests', () => {
    // Test isValidChoice with extreme inputs
    it('should handle extreme inputs in isValidChoice', () => {
      // Very large numbers
      expect(GameService.isValidChoice(999999, [1, 2, 3], 'play_card')).toBe(false);
      expect(GameService.isValidChoice(-999999, [1, 2, 3], 'play_card')).toBe(false);
      
      // Special JavaScript values
      expect(GameService.isValidChoice(Infinity, [1, 2, 3], 'play_card')).toBe(false);
      expect(GameService.isValidChoice(-Infinity, [1, 2, 3], 'play_card')).toBe(false);
      expect(GameService.isValidChoice(NaN, [1, 2, 3], 'play_card')).toBe(false);
      
      // Empty strings and whitespace
      expect(GameService.isValidChoice('', [1, 2, 3], 'play_card')).toBe(false);
      expect(GameService.isValidChoice('   ', [1, 2, 3], 'play_card')).toBe(false);
      
      // Objects and arrays as choices
      expect(GameService.isValidChoice({}, [1, 2, 3], 'play_card')).toBe(false);
      expect(GameService.isValidChoice([], [1, 2, 3], 'play_card')).toBe(false);
    });

    // Test parseAckResponse with malformed data
    it('should handle malformed data in parseAckResponse', () => {
      // Circular references
      const circular = {};
      circular.self = circular;
      
      const result1 = GameService.parseAckResponse([1, 2, 3], 'play_card', circular);
      expect(result1).toBeDefined(); // Should not throw
      
      // Very large arrays
      const largeArray = new Array(10000).fill(0).map((_, i) => i);
      const result2 = GameService.parseAckResponse(largeArray, 'play_card', [5000]);
      expect(result2).toBe(5000);
      
      // Deep nested objects
      const deepObject = { a: { b: { c: { d: { e: 'deep' } } } } };
      const result3 = GameService.parseAckResponse('simple', 'play_card', deepObject);
      expect(result3).toBe(deepObject);
    });

    // Test checkIsBarrier with complex game states
    it('should handle complex game states in checkIsBarrier', () => {
      // Game state with many players
      const complexGameState = {
        otherPlayers: {}
      };
      
      // Add 100 players
      for (let i = 0; i < 100; i++) {
        complexGameState.otherPlayers[`player_${i}`] = {
          name: `Player${i}`,
          affected: i % 2 === 0 // Alternating barrier states
        };
      }
      
      // The function takes the first key from Object.keys(), which might not be player_0
      const firstKey = Object.keys(complexGameState.otherPlayers)[0];
      const expectedResult = complexGameState.otherPlayers[firstKey].affected === false;
      
      const result = GameService.checkIsBarrier(complexGameState);
      expect(result).toBe(expectedResult);
      
      // Game state with undefined/null mixed values
      const mixedGameState = {
        otherPlayers: {
          '1': { name: 'Player1', affected: undefined },
          '2': { name: 'Player2', affected: null },
          '3': { name: 'Player3', affected: false },
          '4': { name: 'Player4', affected: true }
        }
      };
      
      const result2 = GameService.checkIsBarrier(mixedGameState);
      expect(result2).toBe(false); // First player has undefined affected
    });
  });

  describe('SocketHandlers Stress Tests', () => {
    // Test normalizeGameResult with complex data structures
    it('should handle complex result structures', () => {
      // Result with deeply nested winner/loser data
      const complexResult = [
        true,
        'very long game log with special characters: 特殊文字 🎮',
        [{ 
          name: 'Winner1', 
          stats: { hp: 100, cards: [1, 2, 3, 4, 5] },
          history: new Array(1000).fill('action')
        }],
        [{ 
          name: 'Loser1', 
          stats: { hp: 0, cards: [] },
          metadata: { reason: 'defeated', timestamp: Date.now() }
        }]
      ];
      
      const normalized = SocketHandlers.normalizeGameResult(complexResult);
      expect(normalized.ok).toBe(true);
      expect(normalized.winners).toHaveLength(1);
      expect(normalized.losers).toHaveLength(1);
      expect(normalized.winners[0].name).toBe('Winner1');
    });

    // Test findPlayerByName with unusual player data
    it('should handle unusual player data structures', () => {
      const longId = 'very_long_id_'.repeat(100);
      const weirdJsonData = {
        players: {
          '特殊ID_123': { name: '特殊プレイヤー名', socketId: 'socket_特殊' },
          'player-with-symbols!@#': { name: 'Player!@#', socketId: 'socket_symbols' },
          '': { name: 'EmptyIdPlayer', socketId: 'socket_empty' }, // empty string ID
        }
      };
      // Add the long ID dynamically
      weirdJsonData.players[longId] = { name: 'LongIdPlayer', socketId: 'socket_long' };
      
      // Should find player with special characters
      const result1 = SocketHandlers.findPlayerByName(weirdJsonData, '特殊プレイヤー名');
      expect(result1).toBeTruthy();
      expect(result1.id).toBe('特殊ID_123');
      
      // Should find player with symbols
      const result2 = SocketHandlers.findPlayerByName(weirdJsonData, 'Player!@#');
      expect(result2).toBeTruthy();
      expect(result2.id).toBe('player-with-symbols!@#');
      
      // Should find player with empty string ID
      const result3 = SocketHandlers.findPlayerByName(weirdJsonData, 'EmptyIdPlayer');
      expect(result3).toBeTruthy();
      expect(result3.id).toBe('');
    });

    // Test generateRoomId uniqueness over many iterations
    it('should generate unique room IDs consistently', () => {
      const roomIds = new Set();
      
      // Generate 1000 room IDs (reduced for performance)
      for (let i = 0; i < 1000; i++) {
        const roomId = SocketHandlers.generateRoomId();
        expect(roomIds.has(roomId)).toBe(false); // Should be unique
        roomIds.add(roomId);
        // Math.random().toString(36).substr(2, 9) can generate varying lengths
        expect(roomId).toMatch(/^room-[a-z0-9]+$/); // Should match pattern with variable length
        expect(roomId.length).toBeGreaterThanOrEqual(6); // At least 'room-' + 1 char
        expect(roomId.length).toBeLessThanOrEqual(14); // At most 'room-' + 9 chars
      }
      
      expect(roomIds.size).toBe(1000); // All should be unique
    });

    // Test buildResultUrl with various special characters
    it('should handle special characters in URL building', () => {
      const specialReasons = [
        'ゲーム終了',
        'タイムアウトで敗北！',
        'Special chars: !@#$%^&*()',
        'Unicode: 🎮🎯🎲',
        'Very long reason text '.repeat(100),
        '', // Empty string
        '   ', // Whitespace only
      ];
      
      specialReasons.forEach(reason => {
        const url = SocketHandlers.buildResultUrl('win', 'room-1', 'player-1', reason);
        expect(url).toContain('result=win');
        expect(url).toContain('roomId=room-1');
        expect(url).toContain('playerId=player-1');
        expect(url).toContain('reason=');
        // URL should be properly formed
        expect(() => new URL(`http://example.com/${url}`)).not.toThrow();
      });
    });
  });

  describe('Integration Stress Tests', () => {
    // Test the combination of multiple functions with edge case data
    it('should handle complex workflow with edge case data', () => {
      // Simulate a complex game scenario
      const gameState = {
        otherPlayers: {
          'cpu_1': { name: 'cpu_1', affected: false },
          'special_player_特殊': { name: '特殊プレイヤー', affected: true }
        }
      };
      
      const playerData = {
        players: {
          'cpu_1': { name: 'cpu_1', socketId: 'cpu_socket' },
          'special_player_特殊': { name: '特殊プレイヤー', socketId: 'special_socket' }
        }
      };
      
      // Check barrier status
      const hasBarrier = GameService.checkIsBarrier(gameState);
      expect(hasBarrier).toBe(true); // CPU has barrier
      
      // Find special player
      const foundPlayer = SocketHandlers.findPlayerByName(playerData, '特殊プレイヤー');
      expect(foundPlayer).toBeTruthy();
      expect(foundPlayer.player.socketId).toBe('special_socket');
      
      // Generate room and build URL
      const roomId = SocketHandlers.generateRoomId();
      const url = SocketHandlers.buildResultUrl('win', roomId, foundPlayer.id, '特殊な勝利条件');
      
      expect(url).toContain(`roomId=${roomId}`);
      expect(url).toContain(`playerId=${foundPlayer.id}`);
    });
  });
});