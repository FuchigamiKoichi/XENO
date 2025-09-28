const CONFIG = require('../config/config');

/**
 * ログ出力を統一フォーマットで管理
 */
class Logger {
  static log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (level === CONFIG.LOG_LEVELS.ERROR) {
      console.error(logMessage, data || '');
    } else if (level === CONFIG.LOG_LEVELS.WARN) {
      console.warn(logMessage, data || '');
    } else {
      console.log(logMessage, data || '');
    }
  }

  static error(message, error = null) {
    this.log(CONFIG.LOG_LEVELS.ERROR, message, error);
  }

  static warn(message, data = null) {
    this.log(CONFIG.LOG_LEVELS.WARN, message, data);
  }

  static info(message, data = null) {
    this.log(CONFIG.LOG_LEVELS.INFO, message, data);
  }

  static debug(message, data = null) {
    this.log(CONFIG.LOG_LEVELS.DEBUG, message, data);
  }
}

module.exports = Logger;