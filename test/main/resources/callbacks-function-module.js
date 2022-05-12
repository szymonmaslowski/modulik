const fs = require('fs');
const path = require('path');
const util = require('util');

const logFilePath = path.resolve(__dirname, 'callbacks-log.txt');

module.exports = async (strategy, cb1, [cb2, cb3] = [], { cb4, cb5 } = {}) => {
  const callbacksResults = [cb1, cb2, cb3, cb4, cb5]
    .filter(Boolean)
    .map(cb => cb());

  if (strategy === 'raw-result') {
    fs.writeFileSync(
      logFilePath,
      callbacksResults.map(r => r && r.toString()).join(),
    );
    return;
  }

  if (strategy === 'result-type') {
    const content = (await Promise.all(callbacksResults))
      .map(r => `${typeof r} ${util.inspect(r)}`)
      .join();
    fs.writeFileSync(logFilePath, content);
  }
};
