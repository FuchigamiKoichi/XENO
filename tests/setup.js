// Jest setup file
// Global test setup and mocks

// Mock console methods for cleaner test output
global.console = {
  ...console,
  // Suppress logs during tests unless explicitly needed
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.createMockSocketIO = () => ({
  emit: jest.fn(),
  to: jest.fn().mockReturnThis(),
  except: jest.fn().mockReturnThis(),
  join: jest.fn(),
  leave: jest.fn()
});

global.createMockGameState = () => ({
  myTurnNumber: 1,
  pred: [
    { subject: 1, predCard: 5 },
    { subject: 2, predCard: 3 }
  ],
  hands: {
    1: [1, 5, 7],
    2: [2, 6, 8]
  },
  otherPlayers: {
    2: { name: 'Player2' }
  }
});