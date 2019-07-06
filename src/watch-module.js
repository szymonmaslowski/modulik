const { fork } = require('child_process');
const { resolve, dirname } = require('path');
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

const launchWatcher = ({ cfg, callerPath, resolveModuleBody }) => {
  const { path, watch, quiet } = cfg;

  const log = createLogger(path, quiet);
  const pathAbsolute = resolve(callerPath, path);
  const pathsToWatchOn = [
    pathAbsolute,
    ...watch.map(fileName => resolve(callerPath, fileName)),
  ];

  let child = null;
  let childReady = false;
  let moduleReady = false;
  let changesDuringRestart = false;

  const messagesQueue = new Set();
  const sendQueuedMessages = () => {
    messagesQueue.forEach(message => {
      child.send(message);
    });
    messagesQueue.clear();
  };

  const callResolversMap = new Map();
  const resolveCall = ({ correlationId, result }) => {
    callResolversMap.get(correlationId)(result);
    callResolversMap.delete(correlationId);
  };

  const resolveModule = (type, body) => {
    let moduleBody = body;
    if (type === 'function') {
      moduleBody = data =>
        new Promise(resolvePromise => {
          const correlationId = v4();
          callResolversMap.set(correlationId, resolvePromise);
          messagesQueue.add({
            type: 'call',
            correlationId,
            data,
          });
          if (moduleReady) {
            sendQueuedMessages();
          }
        });
    }

    resolveModuleBody(moduleBody);
  };

  const runChild = () => {
    child = fork(childPath, [pathAbsolute], { stdio: [0, 1, 2, 'ipc'] });
    child.on('message', message => {
      if (message.type === 'ready') {
        childReady = true;
        if (changesDuringRestart) {
          changesDuringRestart = false;
          // eslint-disable-next-line no-use-before-define
          restartChild();
          return;
        }
        const { moduleType, moduleBody } = message;
        resolveModule(moduleType, moduleBody);
        moduleReady = true;
        log('Ready.');
        sendQueuedMessages();
        return;
      }
      if (message.type === 'call-result') {
        const { correlationId, result } = message;
        resolveCall({ correlationId, result });
      }
    });
  };
  const restartChild = () => {
    if (!childReady) {
      changesDuringRestart = true;
      return;
    }

    log('Restarting..');
    child.on('exit', () => {
      childReady = false;
      moduleReady = false;
      runChild();
    });
    child.kill();
  };

  chokidar
    .watch(pathsToWatchOn, { ignoreInitial: true })
    .on('all', restartChild);
  runChild();

  return () => {
    restartChild();
  };
};

module.exports = (pathOrConfig, config) => {
  const cfg = Object.assign(
    {},
    configDefaults,
    typeof pathOrConfig === 'string' ? { path: pathOrConfig } : pathOrConfig,
    typeof config === 'object' ? config : {},
  );

  const { path, disable } = cfg;
  if (!path) {
    throw new Error('Invalid module path');
  }

  let resolveModuleBody = () => {};
  let restart = () => {};
  const modulePromise = new Promise(resolvePromise => {
    resolveModuleBody = resolvePromise;
  });
  const callerPath = dirname(getCallerFile());

  if (disable) {
    const pathAbsolute = resolve(callerPath, path);
    const originalModule = require(pathAbsolute);
    resolveModuleBody(originalModule);
  } else {
    restart = launchWatcher({ cfg, callerPath, resolveModuleBody });
  }

  return {
    get module() {
      return modulePromise;
    },
    restart,
  };
};
