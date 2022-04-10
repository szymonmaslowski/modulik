module.exports = require(process.env.CI === 'true'
  ? 'modulik'
  : '../../modulik');
