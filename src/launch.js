const { fork } = require('child_process');
const path = require('path');
const chokidar = require('chokidar');
const { v4 } = require('uuid');

const moduleStateIdle = 'moduleStateIdle';
const moduleStateStarting = 'moduleStateStarting';
const moduleStateAccessible = 'moduleStateAccessible';
const childPath = path.resolve(__dirname, 'child.js');
const createLogger = (moduleName, quiet) => {
  const makeMethod = loggingFunction => message => {
    if (quiet) return;
    loggingFunction(`[modulik]: ${moduleName} - ${message}`);
  };
  return {
    info: makeMethod(console.info),
    error: makeMethod(console.error),
  };
};

const launchFully = ({ cfg, onRestart, onReady, onError }) => {
  const moduleFileName = path.parse(cfg.path).base;
  const logger = createLogger(moduleFileName, cfg.quiet);

  let child = null;
  let fsWatcher = null;
  let currentModuleBody = null;
  let moduleState = moduleStateIdle;
  let moduleKilled = false;
  let changesDuringStart = false;

  const bufferOfMessagesToModule = new Set();
  const sendBufferedMessagesToModule = () => {
    bufferOfMessagesToModule.forEach(message => {
      child.send(message);
    });
    bufferOfMessagesToModule.clear();
  };

  const childModuleInvocationsCallbacks = new Map();
  const resolveModuleInvocation = ({ correlationId, result }) => {
    const data = result.error ? undefined : result.data;
    const error = result.error ? new Error(result.data) : undefined;
    childModuleInvocationsCallbacks.get(correlationId)(error, data);
    childModuleInvocationsCallbacks.delete(correlationId);
  };

  const moduleBodyOfFunctionType = (...args) =>
    new Promise((resolve, reject) => {
      if (moduleKilled) {
        reject(new Error('Cannot execute killed module'));
        return;
      }
      // when former module was of function type
      // and after file change it is not a function anymore
      // but still there is a attempt to execute the former module
      if (
        moduleState === moduleStateAccessible &&
        typeof currentModuleBody !== 'function'
      ) {
        reject(
          new Error(
            `Cannot execute module of ${typeof currentModuleBody} type`,
          ),
        );
        return;
      }

      const correlationId = v4();
      const onModuleFinishedExecution = (error, data) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(data);
      };
      childModuleInvocationsCallbacks.set(
        correlationId,
        onModuleFinishedExecution,
      );
      bufferOfMessagesToModule.add({
        type: 'invoke',
        correlationId,
        args,
      });
      if (moduleState === moduleStateAccessible) {
        sendBufferedMessagesToModule();
      }
    });

  const runChild = () => {
    if (moduleState === moduleStateStarting) return;
    moduleState = moduleStateStarting;

    child = fork(childPath, [cfg.path]);
    child.on('message', message => {
      if (message.type === 'ready') {
        if (changesDuringStart) {
          changesDuringStart = false;
          // eslint-disable-next-line no-use-before-define
          restartChild();
          return;
        }

        const { type, body } = message.data;
        currentModuleBody =
          type === 'function' ? moduleBodyOfFunctionType : body;

        moduleState = moduleStateAccessible;
        onReady(currentModuleBody);
        logger.info('Ready.');

        if (type === 'function') {
          sendBufferedMessagesToModule();
        } else if (bufferOfMessagesToModule.size) {
          const result = {
            error: true,
            data: 'Module is not a function. Cannot execute.',
          };
          bufferOfMessagesToModule.forEach(({ correlationId }) => {
            resolveModuleInvocation({ correlationId, result });
          });
          bufferOfMessagesToModule.clear();
          logger.error(
            'There were executions buffered, but the module is not a function anymore. Buffered executions has been forgotten.',
          );
        }
        return;
      }

      if (message.type === 'invocation-result') {
        const { correlationId, result } = message;
        resolveModuleInvocation({ correlationId, result });
      }
    });
    child.on('exit', code => {
      const previousModuleState = moduleState;
      moduleState = moduleStateIdle;

      if (code === 0) return;
      // module has been programatically killed
      if (code === null && previousModuleState === moduleStateIdle) {
        // module was not fully evaluated yet
        if (!currentModuleBody) {
          onError(new Error('Module unavailable'));
        }
        return;
      }

      // module exited because of unknown reason
      logger.error('Exited unexpectedly');
      onError(new Error('Module exited unexpectedly'));
    });
  };

  const stopChild = () =>
    new Promise(resolve => {
      if (moduleState === moduleStateIdle) {
        resolve();
        return;
      }
      child.on('exit', () => {
        resolve();
      });
      moduleState = moduleStateIdle;
      child.kill();
    });

  const restartChild = async () => {
    if (moduleKilled) {
      logger.error('Module killed - cannot restart');
      return;
    }
    logger.info('Restarting..');
    onRestart();
    await stopChild();
    runChild();
  };

  const handleFileChange = () => {
    if (moduleState === moduleStateStarting) {
      changesDuringStart = true;
      return;
    }
    restartChild();
  };

  fsWatcher = chokidar
    .watch(cfg.watch, { ignoreInitial: true, cwd: cfg.callerPath })
    .on('all', handleFileChange);
  runChild();

  const kill = async () => {
    if (moduleKilled) return;
    moduleKilled = true;
    await fsWatcher.close();
    await stopChild();
  };

  return {
    restart: restartChild,
    kill,
  };
};

const launchPhantomly = ({ cfg, onReady, onError }) => {
  try {
    const moduleBody = require(cfg.path);
    onReady(moduleBody);
  } catch (e) {
    onError(e);
  }

  return {
    restart: () => {},
    kill: () => {},
  };
};

const launch = ({ cfg, onRestart, onReady, onError }) =>
  (cfg.disabled ? launchPhantomly : launchFully)({
    cfg,
    onRestart,
    onReady,
    onError,
  });

module.exports = launch;
