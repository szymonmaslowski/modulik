const { fork } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');
const { v4 } = require('uuid');
const { createChildController } = require('../bridge');
const createState = require('../state');
const createLogger = require('./logger');

const childPath = path.resolve(__dirname, '../child.js');

const launchFully = ({
  cfg,
  recreateModulePromise,
  resolveModule,
  rejectModule,
}) => {
  const moduleFileName = path.parse(cfg.path).base;
  const logger = createLogger(moduleFileName, cfg.quiet);
  const childController = createChildController();

  let fsWatcher = null;
  let childProcess = null;
  let currentModuleBody = null;

  const registeredExecutions = new Map();
  const registerExecution = (promiseActions, callback) => {
    const id = v4();
    registeredExecutions.set(id, promiseActions);
    callback(id);
  };
  const getExecution = id => {
    const execution = registeredExecutions.get(id);
    if (!execution) {
      throw new Error('No such execution');
    }
    return execution;
  };
  const rejectRegisteredExecution = (id, error) => {
    getExecution(id).reject(error);
    registeredExecutions.delete(id);
  };

  const restartRequestResolversQueue = new Set();
  const restartRequestRejectersQueue = new Set();
  const getRestartRequestPromise = () => {
    return new Promise((resolve, reject) => {
      restartRequestResolversQueue.add(resolve);
      restartRequestRejectersQueue.add(reject);
    });
  };
  const resolveRestartRequestPromises = () => {
    restartRequestResolversQueue.forEach(resolve => resolve());
    restartRequestResolversQueue.clear();
  };
  const rejectRestartRequestPromises = error => {
    restartRequestRejectersQueue.forEach(reject => reject(error));
    restartRequestRejectersQueue.clear();
  };

  let resolveKillRequestPromise = null;
  const killRequestPromise = new Promise(resolve => {
    resolveKillRequestPromise = resolve;
  });

  const state = createState({
    logReady: () => logger.info('Ready.'),
    logRestarting: () => logger.info('Restarting..'),
    logFailed: () => logger.error('Exited unexpectedly'),
    logCannotRestartKilledModule: () =>
      logger.error('Module killed - cannot restart'),
    recreateModulePromise,
    resolveModule: ({ data: { type, body } }) => {
      currentModuleBody = body;
      if (type === 'function') {
        currentModuleBody = (...args) =>
          new Promise((resolve, reject) =>
            registerExecution({ resolve, reject }, executionId => {
              state.execute({ args, executionId });
            }),
          );
      }
      resolveModule(currentModuleBody);
    },
    areThereExecutionsBuffered: () =>
      childController.areThereInvocationsBuffered(),
    bufferExecution: ({ args, executionId }) => {
      const execution = getExecution(executionId);
      childController.bufferInvocation(args, (error, data) => {
        if (error) {
          execution.reject(error);
          return;
        }
        execution.resolve(data);
      });
    },
    releaseBufferedExecutions: () => {
      childController.releaseBufferedInvocations(message => {
        childProcess.send(message);
      });
    },
    rejectModuleWithFailureError: () => {
      rejectModule(new Error('Module exited unexpectedly'));
    },
    rejectModuleWithAvailabilityError: () => {
      rejectModule(new Error('Module unavailable'));
    },
    rejectExecutionWithKilledModuleError: ({ executionId }) => {
      rejectRegisteredExecution(
        executionId,
        new Error('Cannot execute killed module'),
      );
    },
    rejectExecutionWithInvalidModuleTypeError: ({ executionId, type }) => {
      rejectRegisteredExecution(
        executionId,
        new Error(`Cannot execute module of ${type} type`),
      );
    },
    startFSWatcher: () => {
      fsWatcher = chokidar
        .watch(cfg.watch, { ignoreInitial: true })
        .on('all', () => {
          state.moduleChanged();
        })
        .on('ready', () => {
          state.fSWatcherReady();
        });
    },
    startChildProcess: () => {
      childProcess = fork(childPath, [cfg.path]);
      childProcess.on(
        'message',
        childController.makeMessageHandler({
          onInvocationResult({ correlationId, result }) {
            childController.resolveInvocation({ correlationId, result });
          },
          onModuleReady: ({ data }) => {
            state.ready({ data });
          },
        }),
      );
      childProcess.on('exit', code => {
        state.processExited({ clean: [0, null].includes(code) });
      });
    },
    terminateBufferedExecutions: () => {
      childController.resolveAllInvocations({
        error: true,
        data: 'Module is not a function. Cannot execute.',
      });
    },
    logBufferedExecutionsTerminated: () => {
      logger.error(
        'There were executions buffered, but the module is not a function anymore. Buffered executions has been forgotten.',
      );
    },
    stopChildProcess: () => childProcess.kill(),
    stopFSWatcher: async () => {
      await fsWatcher.close();
      state.fSWatcherStopped();
    },
    notifyRestarted: () => resolveRestartRequestPromises(),
    notifyRestartFailed: () =>
      rejectRestartRequestPromises(new Error('Module exited unexpectedly')),
    notifyKilled: () => resolveKillRequestPromise(),
  });

  return {
    restart: () => {
      const promise = getRestartRequestPromise();
      state.restartRequested();
      return promise;
    },
    kill: () => {
      state.killRequested();
      return killRequestPromise;
    },
  };
};

module.exports = launchFully;
