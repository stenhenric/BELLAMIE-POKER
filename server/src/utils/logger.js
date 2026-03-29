const logger = {
  info: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'test') {
      const logEntry = {
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...meta
      };
      // In a real production environment, this could be sent to Pino/Winston
      console.log(JSON.stringify(logEntry));
    }
  },
  error: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'test') {
      const logEntry = {
        level: 'error',
        message,
        timestamp: new Date().toISOString(),
        ...meta
      };
      console.error(JSON.stringify(logEntry));
    }
  },
  warn: (message, meta = {}) => {
    if (process.env.NODE_ENV !== 'test') {
      const logEntry = {
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...meta
      };
      console.warn(JSON.stringify(logEntry));
    }
  }
};

module.exports = logger;
