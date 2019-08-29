const { fork } = require('child_process');
const { resolve, dirname, parse } = require('path');
const chokidar = require('chokidar');
const getCallerFile = require('get-caller-file');
const { v4 } = require('uuid');

const childPath = resolve(__dirname, 'child.js');
const createLogger = (moduleName, quiet) => message => {
  if (quiet) return;
  console.info(`[WM]: ${moduleName} - ${message}`);
};

const configDefaults = {
  watch: [],
  quiet: false,
  disable: false,
};

const launchWatcher = ({ cfg, callerPath, onRestart, onReady }) => {
  const { path, watch, quiet } = cfg;

  const moduleFileName = parse(path).base;
  const log = createLogger(moduleFileName, quiet);
  const pathAbsolute = resolve(callerPath, path);
  const pathsToWatchOn = [
    pathAbsolute,
    ...watch.map(fileName => resolve(callerPath, fileName)),
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
        new Promise((resolvePromise, rejectPromise) => {
          if (moduleKilled) {
            rejectPromise(new Error('Module is killed, cannot execute'));
            return;
          }

          const correlationId = v4();
          const onModuleFinishedExecution = (data, error) => {
            if (error) {
              rejectPromise(error);
              return;
            }
            resolvePromise(data);
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
    moduleReadyPromise = new Promise(resolvePromise => {
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
          resolvePromise();
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
    new Promise(resolvePromise => {
      child.on('exit', () => {
        moduleReady = false;
        resolvePromise();
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

module.exports = (pathOrConfig, options) => {
  const cfg = Object.assign(
    {},
    configDefaults,
    typeof pathOrConfig === 'string' ? { path: pathOrConfig } : pathOrConfig,
    typeof options === 'object' ? options : {},
  );

  const { path, disable } = cfg;
  if (!path) {
    throw new Error('Invalid module path');
  }

  let apiModule = null;
  let apiRestart = null;
  let apiKill = null;

  let resolveModuleBodyPromise = () => {};
  const callerPath = dirname(getCallerFile());

  const recreateModuleBodyPromise = () => {
    apiModule = new Promise(resolvePromise => {
      resolveModuleBodyPromise = resolvePromise;
    });
  };
  const resolveModuleBody = moduleBody => {
    resolveModuleBodyPromise(
      moduleBody === 'function'
        ? async (...args) => moduleBody(...args)
        : moduleBody,
    );
  };

  if (disable) {
    const pathAbsolute = resolve(callerPath, path);
    const moduleBody = require(pathAbsolute);
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
