const log4js = require('log4js');

log4js.configure({
  appenders: { 
    access: { type: 'file', filename: './log/access.log' },
    error: { type: 'file', filename: './log/error.log' }
  },
  categories: { 
    default: { appenders: ['access'], level: 'info' },
    access: { appenders: ['access'], level: 'info' },
    error: { appenders: ['error'], level: 'info' }
  }
});

module.exports = {
  access: log4js.getLogger("access"),
  error: log4js.getLogger("error")
};

