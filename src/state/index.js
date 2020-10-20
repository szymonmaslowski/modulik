const { interpret } = require('xstate');
const createChildProcessMachine = require('./childProcess');
const createFSWatcherMachine = require('./fsWatcher');
const isState = require('./isState');
const createMainMachine = require('./main');

const createState = ({
  areThereExecutionsBuffered,
  recreateModulePromise,
  resolveModule,
  rejectModuleWithAvailabilityError,
  rejectModuleWithFailureError,
  startFSWatcher,
  stopFSWatcher,
  startChildProcess,
  stopChildProcess,
  notifyKilled,
  notifyRestarted,
  notifyRestartFailed,
  logReady,
  logRestarting,
  logFailed,
  logCannotRestartKilledModule,

  bufferExecution,
  releaseBufferedExecutions,
  rejectExecutionWithKilledModuleError,
  rejectExecutionWithInvalidModuleTypeError,

  terminateBufferedExecutions,
  logBufferedExecutionsTerminated,
}) => {
  const childProcessMachine = createChildProcessMachine({
    startChildProcess,
    stopChildProcess,
  });

  const fsWatcherMachine = createFSWatcherMachine({
    startFSWatcher,
    stopFSWatcher,
  });

  const mainMachine = createMainMachine({
    areThereExecutionsBuffered,
    bufferExecution,
    childProcessMachine,
    fsWatcherMachine,
    logCannotRestartKilledModule,
    logFailed,
    logReady,
    logRestarting,
    notifyKilled,
    notifyRestarted,
    notifyRestartFailed,
    recreateModulePromise,
    rejectExecutionWithKilledModuleError,
    rejectExecutionWithInvalidModuleTypeError,
    rejectModuleWithAvailabilityError,
    rejectModuleWithFailureError,
    releaseBufferedExecutions,
    resolveModule: ({ childProcess }) => {
      resolveModule({ data: childProcess.state.context.readinessData });
    },

    terminateBufferedExecutions,
    logBufferedExecutionsTerminated,
  });

  const service = interpret(mainMachine);
  service.start();

  process.nextTick(() => {
    service.send('START');
  });

  return {
    isStarting: () => isState(service.state, 'starting'),
    isAccessible: () => isState(service.state, 'accessible'),
    isKilled: () => isState(service.state, 'killed'),
    fSWatcherReady: () =>
      service.state.context.fsWatcher.send('FS_WATCHER_READY'),
    moduleChanged: () => service.send('MODULE_CHANGED'),
    restartRequested: () => service.send('RESTART_REQUESTED'),
    ready: data =>
      service.state.context.childProcess.send('CHILD_PROCESS_READY', data),
    execute: ({ args, executionId }) =>
      service.send('EXECUTE', { args, executionId }),
    processExited: ({ clean }) =>
      service.state.context.childProcess.send('CHILD_PROCESS_EXITED', {
        clean,
      }),
    killRequested: () => service.send('KILL_REQUESTED'),
    fSWatcherStopped: () =>
      service.state.context.fsWatcher.send('FS_WATCHER_STOPPED'),
  };
};

module.exports = createState;
