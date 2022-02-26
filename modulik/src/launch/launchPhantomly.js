const path = require('path');
const createLogger = require('./logger');

const launchPhantomly = ({ cfg, resolveModule, rejectModule }) => {
  const moduleFileName = path.parse(cfg.path).base;
  const logger = createLogger(moduleFileName, cfg.quiet);
  process.nextTick(() => {
    try {
      let moduleBody = require(cfg.path);
      if (cfg.transpiler && moduleBody.default) {
        moduleBody = moduleBody.default;
      }
      resolveModule(moduleBody);
      logger.info('Ready.');
    } catch (e) {
      process.stderr.write(`${e.stack}\n`);
      logger.error('Exited unexpectedly');
      rejectModule(new Error('Module exited unexpectedly'));
    }
  });

  return {
    restart: () => {},
    kill: () => {},
  };
};

module.exports = launchPhantomly;
