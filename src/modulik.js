const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const getCallerFile = require('get-caller-file');
const { v4 } = require('uuid');

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

const configDefaults = {
  watch: [],
  quiet: false,
  disable: false,
};

const launchWatcher = ({ cfg, callerPath, onRestart, onReady }) => {
  const moduleFileName = path.parse(cfg.path).base;
  const logger = createLogger(moduleFileName, cfg.quiet);
  const pathAbsolute = path.resolve(callerPath, cfg.path);
  const pathsToWatchOn = [
    pathAbsolute,
    ...cfg.watch.map(fileName => path.resolve(callerPath, fileName)),
  ];

  let child = null;
  let currentModuleBody = null;
  let moduleReady = false;
  let moduleReadyPromise = null;
  let moduleKilled = false;
  let changesDuringRestart = false;

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
      if (moduleReady && typeof currentModuleBody !== 'function') {
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
      if (moduleReady) {
        sendBufferedMessagesToModule();
      }
    });

  const runChild = () => {
    moduleReadyPromise = new Promise(resolve => {
      child = fork(childPath, [pathAbsolute]);
      child.on('message', message => {
        if (message.type === 'ready') {
          if (changesDuringRestart) {
            changesDuringRestart = false;
            // eslint-disable-next-line no-use-before-define
            restartChild();
            return;
          }

          const { type, body } = message.data;
          if (type === 'function') {
            currentModuleBody = moduleBodyOfFunctionType;
          } else {
            currentModuleBody = body;
          }
          moduleReady = true;
          onReady(currentModuleBody);
          resolve();
          logger.info('Ready.');
          if (type === 'function') {
            sendBufferedMessagesToModule();
          } else if (bufferOfMessagesToModule.size) {
            bufferOfMessagesToModule.forEach(({ correlationId }) => {
              resolveModuleInvocation({
                correlationId,
                result: {
                  error: true,
                  data: 'Module is not a function. Cannot execute.',
                },
              });
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
      child.on('exit', (code, signal) => {
        if (!code || !signal) return;
        throw new Error(
          `Watched module exited with status ${code} and signal ${signal}`,
        );
      });
    });
    return moduleReadyPromise;
  };

  const stopChild = () =>
    new Promise(resolve => {
      child.on('exit', () => {
        resolve();
      });
      moduleReady = false;
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
    await runChild();
  };

  const handleFileChange = () => {
    if (!moduleReady) {
      changesDuringRestart = true;
      return;
    }
    restartChild();
  };

  const fsWatcher = chokidar
    .watch(pathsToWatchOn, { ignoreInitial: true })
    .on('all', handleFileChange);
  runChild();

  const kill = async () => {
    if (moduleKilled) return;
    moduleKilled = true;
    fsWatcher.close();
    await moduleReadyPromise;
    await stopChild();
  };

  return {
    restart: restartChild,
    kill,
  };
};

const fileExtensions = ['js', 'json'];

module.exports = (pathOrOptions, options) => {
  const callerPath = path.dirname(getCallerFile());
  let providedPath = pathOrOptions;
  if (typeof pathOrOptions === 'object') {
    providedPath = pathOrOptions.path;
  }
  if (typeof options === 'object' && Boolean(options.path)) {
    providedPath = options.path;
  }
  const pathAbsolute = path.resolve(callerPath, providedPath);
  let cfg = Object.assign(
    {},
    configDefaults,
    typeof pathOrOptions === 'object' ? pathOrOptions : {},
    typeof options === 'object' ? options : {},
    { path: pathAbsolute },
  );

  if (!cfg.path) {
    throw new Error('Invalid module path');
  }
  if (!path.parse(cfg.path).ext) {
    const matchingExtension = fileExtensions.find(ext => {
      try {
        fs.readFileSync(`${cfg.path}.${ext}`);
        return true;
      } catch (e) {
        return false;
      }
    });
    if (!matchingExtension) {
      // Throw native node exception about that file doesn't exist
      require(cfg.path);
      throw new Error(`Cannot access file ${cfg.path}`);
    }
    cfg = Object.assign({}, cfg, { path: `${cfg.path}.${matchingExtension}` });
  }

  let apiModule = null;
  let apiRestart = null;
  let apiKill = null;

  let resolveModuleBodyPromise = () => {};

  const recreateModuleBodyPromise = () => {
    apiModule = new Promise(resolve => {
      resolveModuleBodyPromise = resolve;
    });
  };
  const resolveModuleBody = moduleBody => {
    resolveModuleBodyPromise(
      moduleBody === 'function'
        ? async (...args) => moduleBody(...args)
        : moduleBody,
    );
  };

  if (cfg.disable) {
    const moduleBody = require(cfg.path);
    recreateModuleBodyPromise();
    resolveModuleBody(moduleBody);
    apiRestart = () => {};
    apiKill = () => {};
  } else {
    recreateModuleBodyPromise();
    const { restart, kill } = launchWatcher({
      cfg,
      callerPath,
      onRestart: recreateModuleBodyPromise,
      onReady: resolveModuleBody,
    });
    apiRestart = restart;
    apiKill = async () => {
      await apiModule;
      await kill();
    };
  }

  return {
    get module() {
      return apiModule;
    },
    restart: async () => apiRestart(),
    kill: async () => apiKill(),
  };
};
