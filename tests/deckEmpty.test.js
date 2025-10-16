const { Field } = require('../public/src/field.js');
const { Game } = require('../public/src/game.js');

// HTML5 Audio APIのモック
global.HTMLMediaElement = {
    prototype: {
        play: jest.fn().mockResolvedValue(),
        pause: jest.fn(),
        load: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
    }
};

global.Audio = jest.fn().mockImplementation(() => ({
    play: jest.fn().mockResolvedValue(),
    pause: jest.fn(),
    load: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    src: '',
    volume: 1,
    currentTime: 0,
    duration: NaN,
    paused: true,
    muted: false
}));

describe('XENO Game - Deck Empty Handling Tests', () => {
    describe('Field Draw Method with Empty Deck', () => {
        it('should return early when deck is empty', async () => {
            // Create mock players
            const mockPlayer1 = {
                name: 'Player1',
                hands: [],
                get: 1,
                socketId: 'player1',
                choice: jest.fn().mockResolvedValue(1)
            };
            
            const mockPlayer2 = {
                name: 'Player2', 
                hands: [],
                get: 1,
                socketId: 'player2',
                choice: jest.fn().mockResolvedValue(1)
            };
            
            // Create field with empty deck
            const field = new Field([mockPlayer1, mockPlayer2], null);
            field.deck = []; // Force empty deck
            
            const initialHandSize = mockPlayer1.hands.length;
            
            // Should not throw error when drawing from empty deck
            await expect(field.draw(mockPlayer1, 'room1')).resolves.not.toThrow();
            
            // Player should not get any new cards
            expect(mockPlayer1.hands.length).toBe(initialHandSize);
        });
        
        it('should handle deck exhaustion scenario gracefully', () => {
            // Create mock game data
            const mockGameData = {
                roomId: 'test-room',
                players: ['player1', 'player2']
            };
            
            // Create mock functions for players
            const mockFuncs = [
                { 
                    get_name: (roomId, index) => `Player${index + 1}`, 
                    choice: jest.fn().mockResolvedValue(1) 
                },
                { 
                    get_name: (roomId, index) => `Player${index + 1}`, 
                    choice: jest.fn().mockResolvedValue(1) 
                }
            ];
            
            // Create game instance
            const game = new Game(2, mockFuncs, mockGameData);
            
            // Force deck to be empty to test win condition
            game.field.deck = [];
            
            // Test win condition with empty deck
            const result = game.isContinue();
            
            // Should return proper game state even with empty deck
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(3); // [continue, winners, losers]
        });
    });
});