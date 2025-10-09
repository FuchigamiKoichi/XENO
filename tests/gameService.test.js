const GameService = require('../services/gameService');
const CONFIG = require('../config/config');

// Mock dependencies
jest.mock('../public/src/game.js', () => ({
  Game: jest.fn()
}));
jest.mock('../select.js', () => ({
  selectBestChoice: jest.fn()
}));

describe('GameService', () => {
  describe('isValidChoice', () => {
    beforeEach(() => {
      // Reset console mocks
      console.debug = jest.fn();
    });

    it('should return true for update kind with any value', () => {
      const result = GameService.isValidChoice(
        'any value',
        [],
        CONFIG.GAME_RULES.CHOICE_TYPES.UPDATE
      );

      expect(result).toBe(true);
    });

    it('should return true for update kind with null', () => {
      const result = GameService.isValidChoice(
        null,
        [],
        CONFIG.GAME_RULES.CHOICE_TYPES.UPDATE
      );

      expect(result).toBe(true);
    });

    it('should return false for null choice with non-update kind', () => {
      const result = GameService.isValidChoice(
        null,
        [1, 2, 3],
        'play_card'
      );

      expect(result).toBe(false);
    });

    it('should return false for undefined choice with non-update kind', () => {
      const result = GameService.isValidChoice(
        undefined,
        [1, 2, 3],
        'play_card'
      );

      expect(result).toBe(false);
    });

    it('should validate array choices correctly for play_card', () => {
      const validResult = GameService.isValidChoice(
        2,
        [1, 2, 3],
        'play_card'
      );

      const invalidResult = GameService.isValidChoice(
        5,
        [1, 2, 3],
        'play_card'
      );

      expect(validResult).toBe(true);
      expect(invalidResult).toBe(false);
    });

    it('should validate string numbers for array choices', () => {
      const validResult = GameService.isValidChoice(
        '2',
        [1, 2, 3],
        'play_card'
      );

      expect(validResult).toBe(true);
    });

    it('should validate opponentChoice by selectNumber', () => {
      const choices = [
        { selectNumber: 1, player: 10 },
        { selectNumber: 2, player: 20 }
      ];

      const validBySelectNumber = GameService.isValidChoice(
        1,
        choices,
        CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE
      );

      expect(validBySelectNumber).toBe(true);
    });

    it('should validate opponentChoice by player number', () => {
      const choices = [
        { selectNumber: 1, player: 10 },
        { selectNumber: 2, player: 20 }
      ];

      const validByPlayer = GameService.isValidChoice(
        20,
        choices,
        CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE
      );

      expect(validByPlayer).toBe(true);
    });

    it('should validate opponentChoice with string numbers', () => {
      const choices = [
        { selectNumber: 1, player: 10 },
        { selectNumber: 2, player: 20 }
      ];

      const validByStringSelectNumber = GameService.isValidChoice(
        '1',
        choices,
        CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE
      );

      const validByStringPlayer = GameService.isValidChoice(
        '20',
        choices,
        CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE
      );

      expect(validByStringSelectNumber).toBe(true);
      expect(validByStringPlayer).toBe(true);
    });

    it('should return false for invalid opponentChoice', () => {
      const choices = [
        { selectNumber: 1, player: 10 },
        { selectNumber: 2, player: 20 }
      ];

      const invalid = GameService.isValidChoice(
        99,
        choices,
        CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE
      );

      expect(invalid).toBe(false);
    });

    it('should return true for non-array choices with unknown kind', () => {
      const result = GameService.isValidChoice(
        'any_value',
        'non_array_choices',
        'unknown_kind'
      );

      expect(result).toBe(true);
    });
  });

  describe('getFallbackChoice', () => {
    it('should return first choice for simple array', () => {
      const result = GameService.getFallbackChoice(
        [1, 2, 3],
        'play_card',
        'test error'
      );

      expect(result).toBe(1);
    });

    it('should return selectNumber for opponentChoice', () => {
      const choices = [
        { selectNumber: 5, player: 10 },
        { selectNumber: 7, player: 20 }
      ];

      const result = GameService.getFallbackChoice(
        choices,
        CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE,
        'test error'
      );

      expect(result).toBe(5);
    });

    it('should return first choice for non-opponentChoice object array', () => {
      const choices = [
        { selectNumber: 5, player: 10 },
        { selectNumber: 7, player: 20 }
      ];

      const result = GameService.getFallbackChoice(
        choices,
        'play_card',
        'test error'
      );

      expect(result).toEqual({ selectNumber: 5, player: 10 });
    });

    it('should return null for empty choices', () => {
      const result = GameService.getFallbackChoice(
        [],
        'play_card',
        'test error'
      );

      expect(result).toBeNull();
    });

    it('should return null for null choices', () => {
      const result = GameService.getFallbackChoice(
        null,
        'play_card',
        'test error'
      );

      expect(result).toBeNull();
    });

    it('should handle exception gracefully', () => {
      // エラーを発生させる不正な選択肢
      const invalidChoices = Object.create(null);
      invalidChoices.toString = () => { throw new Error('test error'); };

      const result = GameService.getFallbackChoice(
        invalidChoices,
        'play_card',
        'test error'
      );

      expect(result).toBeNull();
    });
  });

  describe('parseAckResponse', () => {
    it('should parse array response correctly', () => {
      const result = GameService.parseAckResponse([1, 2, 3], 'play_card', [1]);
      expect(result).toBe(2); // choices[1]
    });

    it('should return direct value for non-array choices', () => {
      const result = GameService.parseAckResponse('single', 'update', 'response');
      expect(result).toBe('response');
    });

    it('should handle update kind with null response', () => {
      const result = GameService.parseAckResponse([1, 2, 3], CONFIG.GAME_RULES.CHOICE_TYPES.UPDATE, null);
      expect(result).toEqual([1, 2, 3]); // returns choices when response is null
    });

    it('should handle update kind with undefined response', () => {
      const result = GameService.parseAckResponse([1, 2, 3], CONFIG.GAME_RULES.CHOICE_TYPES.UPDATE, undefined);
      expect(result).toEqual([1, 2, 3]); // returns choices when response is undefined
    });

    it('should handle update kind with valid response', () => {
      const result = GameService.parseAckResponse([1, 2, 3], CONFIG.GAME_RULES.CHOICE_TYPES.UPDATE, [2]);
      expect(result).toBe(2); // returns first element of response array
    });

    it('should parse opponentChoice by index to get player value', () => {
      const choices = [
        { selectNumber: 1, player: 10 },
        { selectNumber: 2, player: 20 }
      ];
      const result = GameService.parseAckResponse(choices, CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE, [0]);
      expect(result).toBe(10); // choices[0].player
    });

    it('should handle opponentChoice with valid index', () => {
      const choices = [
        { selectNumber: 1, player: 10 },
        { selectNumber: 2, player: 20 }
      ];
      const result = GameService.parseAckResponse(choices, CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE, [1]);
      expect(result).toBe(20); // choices[1].player
    });

    it('should handle opponentChoice with invalid index', () => {
      const choices = [
        { selectNumber: 1, player: 10 },
        { selectNumber: 2, player: 20 }
      ];
      const result = GameService.parseAckResponse(choices, CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE, [5]);
      expect(result).toBe(5); // returns the invalid index as fallback
    });

    it('should handle opponentChoice with object without player property', () => {
      const choices = [
        { selectNumber: 1 }, // missing player property
        { selectNumber: 2, player: 20 }
      ];
      const result = GameService.parseAckResponse(choices, CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE, [0]);
      expect(result).toEqual({ selectNumber: 1 }); // returns the object itself
    });

    it('should handle non-array response', () => {
      const result = GameService.parseAckResponse([1, 2, 3], 'play_card', 'direct_value');
      expect(result).toBe('direct_value');
    });

    it('should handle null choices with array response', () => {
      const result = GameService.parseAckResponse(null, 'play_card', [0]);
      expect(result).toBe(0); // returns first element when choices is null
    });
  });

  describe('checkIsBarrier', () => {
    it('should return true when player has barrier effect (affected=false)', () => {
      const gameState = {
        otherPlayers: {
          '2': {
            name: 'Player2',
            affected: false // barrier effect active
          }
        }
      };

      const result = GameService.checkIsBarrier(gameState);
      expect(result).toBe(true);
    });

    it('should return false when player is not protected (affected=true)', () => {
      const gameState = {
        otherPlayers: {
          '2': {
            name: 'Player2',
            affected: true // no barrier effect
          }
        }
      };

      const result = GameService.checkIsBarrier(gameState);
      expect(result).toBe(false);
    });

    it('should return false when affected property is undefined', () => {
      const gameState = {
        otherPlayers: {
          '2': {
            name: 'Player2'
            // affected property missing
          }
        }
      };

      const result = GameService.checkIsBarrier(gameState);
      expect(result).toBe(false);
    });

    it('should handle missing otherPlayers gracefully', () => {
      const gameState = {};

      const result = GameService.checkIsBarrier(gameState);
      expect(result).toBe(false);
    });

    it('should handle empty otherPlayers gracefully', () => {
      const gameState = {
        otherPlayers: {}
      };

      const result = GameService.checkIsBarrier(gameState);
      expect(result).toBe(false);
    });

    it('should handle null gameState gracefully', () => {
      const result = GameService.checkIsBarrier(null);
      expect(result).toBe(false);
    });

    it('should handle affected property as null', () => {
      const gameState = {
        otherPlayers: {
          '1': {
            name: 'Player1',
            affected: null
          }
        }
      };

      const result = GameService.checkIsBarrier(gameState);
      expect(result).toBe(false);
    });

    it('should handle multiple players and return first player barrier status', () => {
      const gameState = {
        otherPlayers: {
          '1': {
            name: 'Player1', 
            affected: false // barrier active for first player
          },
          '2': {
            name: 'Player2',
            affected: true // no barrier for second player
          }
        }
      };

      const result = GameService.checkIsBarrier(gameState);
      expect(result).toBe(true); // should return first player's barrier status
    });
  });
});