const SocketHandlers = require('../handlers/socketHandlers');

// Mock dependencies
jest.mock('../config/config');
jest.mock('../utils/logger');
jest.mock('../managers/dataManager');
jest.mock('../managers/roomManager');
jest.mock('../services/gameService');

describe('SocketHandlers', () => {
  describe('normalizeGameResult', () => {
    it('should normalize successful game result with complete data', () => {
      const result = [true, 'gameLog', [{ name: 'Player1' }], [{ name: 'Player2' }]];
      
      const normalized = SocketHandlers.normalizeGameResult(result);
      
      expect(normalized).toEqual({
        winners: [{ name: 'Player1' }],
        losers: [{ name: 'Player2' }],
        ok: true
      });
    });

    it('should normalize successful game result with empty winners/losers', () => {
      const result = [true, 'gameLog', [], []];
      
      const normalized = SocketHandlers.normalizeGameResult(result);
      
      expect(normalized).toEqual({
        winners: [],
        losers: [],
        ok: true
      });
    });

    it('should normalize early termination result', () => {
      const result = [false, [{ name: 'Player1' }], [{ name: 'Player2' }]];
      
      const normalized = SocketHandlers.normalizeGameResult(result);
      
      expect(normalized).toEqual({
        winners: [{ name: 'Player1' }],
        losers: [{ name: 'Player2' }],
        ok: false
      });
    });

    it('should handle null result', () => {
      const result = null;
      
      const normalized = SocketHandlers.normalizeGameResult(result);
      
      expect(normalized).toEqual({
        winners: [],
        losers: [],
        ok: false
      });
    });

    it('should handle undefined result', () => {
      const result = undefined;
      
      const normalized = SocketHandlers.normalizeGameResult(result);
      
      expect(normalized).toEqual({
        winners: [],
        losers: [],
        ok: false
      });
    });

    it('should handle empty array result', () => {
      const result = [];
      
      const normalized = SocketHandlers.normalizeGameResult(result);
      
      expect(normalized).toEqual({
        winners: [],
        losers: [],
        ok: false
      });
    });

    it('should handle incomplete result arrays', () => {
      const result = [true, 'gameLog'];
      
      const normalized = SocketHandlers.normalizeGameResult(result);
      
      expect(normalized).toEqual({
        winners: [],
        losers: [],
        ok: true
      });
    });
  });

  describe('findPlayerById', () => {
    it('should find player by id', () => {
      const jsonData = {
        players: {
          'player-1': { name: 'Alice' },
          'player-2': { name: 'Bob' },
          'player-3': { name: 'Charlie' }
        }
      };

      const result = SocketHandlers.findPlayerById(jsonData, 'player-2');
      
      expect(result).toEqual({
        id: 'player-2',
        player: { name: 'Bob' }
      });
    });

    it('should return null when player not found', () => {
      const jsonData = {
        players: {
          'player-1': { name: 'Alice' }
        }
      };

      const result = SocketHandlers.findPlayerById(jsonData, 'nonexistent-id');
      
      expect(result).toBeNull();
    });

    it('should handle empty players object', () => {
      const jsonData = { players: {} };

      const result = SocketHandlers.findPlayerById(jsonData, 'player-1');
      
      expect(result).toBeNull();
    });

    it('should handle null jsonData', () => {
      const result = SocketHandlers.findPlayerById(null, 'player-1');
      
      expect(result).toBeNull();
    });

    it('should handle missing players property', () => {
      const jsonData = {};

      const result = SocketHandlers.findPlayerById(jsonData, 'player-1');
      
      expect(result).toBeNull();
    });
  });

  describe('buildResultUrl', () => {
    it('should build result URL with basic parameters', () => {
      const url = SocketHandlers.buildResultUrl('win', 'room-1', 'player-1');
      
      expect(url).toBe('result.html?result=win&reason=%E3%82%B2%E3%83%BC%E3%83%A0%E7%B5%82%E4%BA%86&roomId=room-1&playerId=player-1');
    });

    it('should build result URL with custom reason', () => {
      const url = SocketHandlers.buildResultUrl('lose', 'room-2', 'player-2', 'タイムアウト');
      
      expect(url).toContain('result=lose');
      expect(url).toContain('roomId=room-2');
      expect(url).toContain('playerId=player-2');
      expect(url).toContain('reason='); // reason is URL encoded
    });

    it('should handle special characters in reason', () => {
      const url = SocketHandlers.buildResultUrl('win', 'room-1', 'player-1', 'Special & Characters!');
      
      expect(url).toContain('result=win');
      expect(url).toContain('reason='); // Should be URL encoded
    });
  });

  describe('generateRoomId', () => {
    it('should generate room ID with correct prefix', () => {
      const roomId = SocketHandlers.generateRoomId();
      
      expect(roomId).toMatch(/^room-[a-z0-9]{9}$/);
    });

    it('should generate unique room IDs', () => {
      const roomId1 = SocketHandlers.generateRoomId();
      const roomId2 = SocketHandlers.generateRoomId();
      
      expect(roomId1).not.toBe(roomId2);
    });

    it('should generate room IDs of correct length', () => {
      const roomId = SocketHandlers.generateRoomId();
      
      expect(roomId.length).toBe(14); // 'room-' (5) + 9 characters
    });
  });
});