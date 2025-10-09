const Logger = require('../utils/logger');
const CONFIG = require('../config/config');

// Mock console methods
const originalConsole = console;

describe('Logger', () => {
  let mockConsole;

  beforeEach(() => {
    mockConsole = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };
    global.console = mockConsole;
  });

  afterEach(() => {
    global.console = originalConsole;
  });

  describe('log method', () => {
    it('should call console.log for info level', () => {
      Logger.log('INFO', 'Test message', { data: 'test' });
      
      expect(mockConsole.log).toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('should call console.error for error level', () => {
      Logger.log('ERROR', 'Error message', new Error('test'));
      
      expect(mockConsole.error).toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('should call console.warn for warn level', () => {
      Logger.log('WARN', 'Warning message');
      
      expect(mockConsole.warn).toHaveBeenCalled();
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it('should include timestamp in log message', () => {
      Logger.log('INFO', 'Test message');
      
      const logCall = mockConsole.log.mock.calls[0][0];
      expect(logCall).toMatch(/\[.*\] \[INFO\] Test message/);
    });
  });

  describe('convenience methods', () => {
    it('should call error method correctly', () => {
      const error = new Error('Test error');
      Logger.error('Error occurred', error);
      
      expect(mockConsole.error).toHaveBeenCalled();
      const logCall = mockConsole.error.mock.calls[0][0];
      expect(logCall).toContain('[ERROR] Error occurred');
    });

    it('should call warn method correctly', () => {
      Logger.warn('Warning message', { context: 'test' });
      
      expect(mockConsole.warn).toHaveBeenCalled();
      const logCall = mockConsole.warn.mock.calls[0][0];
      expect(logCall).toContain('[WARN] Warning message');
    });

    it('should call info method correctly', () => {
      Logger.info('Info message');
      
      expect(mockConsole.log).toHaveBeenCalled();
      const logCall = mockConsole.log.mock.calls[0][0];
      expect(logCall).toContain('[INFO] Info message');
    });

    it('should call debug method correctly', () => {
      Logger.debug('Debug message');
      
      expect(mockConsole.log).toHaveBeenCalled();
      const logCall = mockConsole.log.mock.calls[0][0];
      expect(logCall).toContain('[DEBUG] Debug message');
    });
  });

  describe('message formatting', () => {
    it('should handle messages without data', () => {
      Logger.info('Simple message');
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Simple message'),
        ''
      );
    });

    it('should handle messages with data', () => {
      const testData = { key: 'value' };
      Logger.info('Message with data', testData);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Message with data'),
        testData
      );
    });

    it('should handle null data gracefully', () => {
      Logger.info('Message with null data', null);
      
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Message with null data'),
        ''
      );
    });
  });
});