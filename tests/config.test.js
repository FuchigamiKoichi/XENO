const CONFIG = require('../config/config');

describe('CONFIG', () => {
  describe('Server Configuration', () => {
    it('should have correct server settings', () => {
      expect(CONFIG.PORT).toBe(3000);
      expect(CONFIG.DATA_FILE).toBe('./data.json');
      expect(CONFIG.MAX_PLAYERS_PER_ROOM).toBe(2);
      expect(CONFIG.SOCKET_TIMEOUT).toBe(60000);
    });
  });

  describe('Game Rules', () => {
    it('should have correct card settings', () => {
      expect(CONFIG.GAME_RULES.CARDS.HERO).toBe(10);
      expect(CONFIG.GAME_RULES.CARDS.MIN_CARD).toBe(1);
      expect(CONFIG.GAME_RULES.CARDS.MAX_CARD).toBe(10);
    });

    it('should have correct choice types', () => {
      expect(CONFIG.GAME_RULES.CHOICE_TYPES.PLAY_CARD).toBe('play_card');
      expect(CONFIG.GAME_RULES.CHOICE_TYPES.OPPONENT_CHOICE).toBe('opponentChoice');
      expect(CONFIG.GAME_RULES.CHOICE_TYPES.PREDICTION).toBe('pred');
      expect(CONFIG.GAME_RULES.CHOICE_TYPES.TRASH).toBe('trush');
      expect(CONFIG.GAME_RULES.CHOICE_TYPES.UPDATE).toBe('update');
    });

    it('should have game restrictions defined', () => {
      expect(CONFIG.GAME_RULES.RESTRICTIONS.HERO_UNPLAYABLE).toBeDefined();
      expect(typeof CONFIG.GAME_RULES.RESTRICTIONS.HERO_UNPLAYABLE).toBe('string');
    });
  });

  describe('Configuration Structure', () => {
    it('should have all required top-level properties', () => {
      expect(CONFIG).toHaveProperty('PORT');
      expect(CONFIG).toHaveProperty('DATA_FILE');
      expect(CONFIG).toHaveProperty('MAX_PLAYERS_PER_ROOM');
      expect(CONFIG).toHaveProperty('SOCKET_TIMEOUT');
      expect(CONFIG).toHaveProperty('GAME_RULES');
    });

    it('should have properly structured GAME_RULES', () => {
      expect(CONFIG.GAME_RULES).toHaveProperty('CARDS');
      expect(CONFIG.GAME_RULES).toHaveProperty('CHOICE_TYPES');
      expect(CONFIG.GAME_RULES).toHaveProperty('RESTRICTIONS');
    });
  });

  describe('Data Types', () => {
    it('should have correct data types for server config', () => {
      expect(typeof CONFIG.PORT).toBe('number');
      expect(typeof CONFIG.DATA_FILE).toBe('string');
      expect(typeof CONFIG.MAX_PLAYERS_PER_ROOM).toBe('number');
      expect(typeof CONFIG.SOCKET_TIMEOUT).toBe('number');
    });

    it('should have string values for choice types', () => {
      Object.values(CONFIG.GAME_RULES.CHOICE_TYPES).forEach(choiceType => {
        expect(typeof choiceType).toBe('string');
      });
    });

    it('should have number values for card settings', () => {
      expect(typeof CONFIG.GAME_RULES.CARDS.HERO).toBe('number');
      expect(typeof CONFIG.GAME_RULES.CARDS.MIN_CARD).toBe('number');
      expect(typeof CONFIG.GAME_RULES.CARDS.MAX_CARD).toBe('number');
    });
  });
});