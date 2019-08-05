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

const launchWatcher = ({ cfg, callerPath }) => {
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
  let moduleKilled = false;
  let changesDuringRestart = false;
  let resolveModuleBody = () => {};
  let moduleBodyPromise = null;

  const recreateModuleBodyPromise = () => {
    moduleBodyPromise = new Promise(resolvePromise => {
      resolveModuleBody = resolvePromise;
    });
  };

  const messagesToModuleBuffer = new Set();
  const sendBufferedMessagesToModule = () => {
    messagesToModuleBuffer.forEach(message => {
      child.send(message);
    });
    messagesToModuleBuffer.clear();
  };

  const childModuleInvocationsCallbacksMap = new Map();
  const resolveModuleInvocation = ({ correlationId, result }) => {
    childModuleInvocationsCallbacksMap.get(correlationId)(result);
    childModuleInvocationsCallbacksMap.delete(correlationId);
  };

  const resolveModule = (type, body) => {
    let moduleBody = body;
    if (type === 'function') {
      moduleBody = (...args) =>
        new Promise(resolvePromise => {
          const correlationId = v4();
          childModuleInvocationsCallbacksMap.set(correlationId, resolvePromise);
          messagesToModuleBuffer.add({
            type: 'invoke',
            correlationId,
            args,
          });
          if (moduleReady) {
            sendBufferedMessagesToModule();
          }
        });
    }
    resolveModuleBody(moduleBody);
  };

  const runChild = () =>
    new Promise(resolvePromise => {
      child = fork(childPath, [pathAbsolute]);
      child.on('message', message => {
        if (message.type === 'ready') {
          if (changesDuringRestart) {
            changesDuringRestart = false;
            // eslint-disable-next-line no-use-before-define
            restartChild();
            return;
          }

          const { moduleType, moduleBody } = message;
          resolveModule(moduleType, moduleBody);
          moduleReady = true;
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
    recreateModuleBodyPromise();
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

  recreateModuleBodyPromise();
  const fsWatcher = chokidar
    .watch(pathsToWatchOn, { ignoreInitial: true })
    .on('all', handleFileChange);
  runChild();

  const getModule = () =>
    new Promise((resolvePromise, rejectPromise) => {
      if (moduleKilled) {
        rejectPromise(new Error('Module killed'));
        return;
      }

      moduleBodyPromise.then(resolvePromise);
    });

  const kill = async () => {
    if (moduleKilled) return;
    moduleKilled = true;
    fsWatcher.close();
    await stopChild();
  };

  return {
    getModule,
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

  let getModule = null;
  let restart = null;
  let kill = null;
  const callerPath = dirname(getCallerFile());

  if (disable) {
    const pathAbsolute = resolve(callerPath, path);
    const originalModule = require(pathAbsolute);
    getModule = () => Promise.resolve(originalModule);
    restart = () => Promise.resolve();
    kill = () => Promise.resolve();
  } else {
    const watcher = launchWatcher({ cfg, callerPath });
    /* eslint-disable prefer-destructuring */
    getModule = async () => watcher.getModule();
    restart = async () => watcher.restart();
    kill = async () => watcher.kill();
    /* eslint-enable prefer-destructuring */
  }

  return {
    get module() {
      return getModule();
    },
    restart,
    kill,
  };
};
