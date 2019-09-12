const { fork } = require('child_process');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const getCallerFile = require('get-caller-file');
const { v4 } = require('uuid');

const childPath = path.resolve(__dirname, 'child.js');
const createLogger = (moduleName, quiet) => message => {
  if (quiet) return;
  console.info(`[modulik]: ${moduleName} - ${message}`);
};

const configDefaults = {
  watch: [],
  quiet: false,
  disable: false,
};

const launchWatcher = ({ cfg, callerPath, onRestart, onReady }) => {
  const moduleFileName = path.parse(cfg.path).base;
  const log = createLogger(moduleFileName, cfg.quiet);
  const pathAbsolute = path.resolve(callerPath, cfg.path);
  const pathsToWatchOn = [
    pathAbsolute,
    ...cfg.watch.map(fileName => path.resolve(callerPath, fileName)),
  ];

  let child = null;
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
    childModuleInvocationsCallbacks.get(correlationId)(data, error);
    childModuleInvocationsCallbacks.delete(correlationId);
  };

  const resolveModule = (type, body) => {
    let moduleBody = body;
    if (type === 'function') {
      moduleBody = (...args) =>
        new Promise((resolve, reject) => {
          if (moduleKilled) {
            reject(new Error('Module is killed, cannot execute'));
            return;
          }

          const correlationId = v4();
          const onModuleFinishedExecution = (data, error) => {
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
    }
    return moduleBody;
  };

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
          const moduleBody = resolveModule(type, body);
          moduleReady = true;
          onReady(moduleBody);
          resolve();
          log('Ready.');
          sendBufferedMessagesToModule();
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
        moduleReady = false;
        resolve();
      });
      child.kill();
    });

  const restartChild = async () => {
    log('Restarting..');
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
  const pathAbsolute = path.resolve(
    callerPath,
    typeof pathOrOptions === 'string' ? pathOrOptions : pathOrOptions.path,
  );
  let cfg = Object.assign(
    {},
    configDefaults,
    { path: pathAbsolute },
    typeof options === 'object' ? options : {},
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
