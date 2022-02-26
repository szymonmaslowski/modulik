const { interpret } = require('xstate');
const createChildProcessMachine = require('./childProcess');
const createFSWatcherMachine = require('./fsWatcher');
const createMainMachine = require('./main');

const createState = ({
  areThereExecutionsBuffered,
  bufferExecution,
  logBufferedExecutionsTerminated,
  logCannotRestartKilledModule,
  logFailed,
  logReady,
  logRestarting,
  logTranspilerError,
  notifyKilled,
  notifyRestarted,
  notifyRestartFailed,
  recreateModulePromise,
  rejectExecutionWithKilledModuleError,
  rejectExecutionWithInvalidModuleTypeError,
  rejectModuleWithAvailabilityError,
  rejectModuleWithFailureError,
  rejectModuleWithTranspilerError,
  releaseBufferedExecutions,
  resolveModule,
  startFSWatcher,
  stopFSWatcher,
  startChildProcess,
  stopChildProcess,
  terminateBufferedExecutions,
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
    logBufferedExecutionsTerminated,
    logCannotRestartKilledModule,
    logFailed,
    logReady,
    logRestarting,
    logTranspilerError,
    notifyKilled,
    notifyRestarted,
    notifyRestartFailed,
    recreateModulePromise,
    rejectExecutionWithKilledModuleError,
    rejectExecutionWithInvalidModuleTypeError,
    rejectModuleWithAvailabilityError,
    rejectModuleWithFailureError,
    rejectModuleWithTranspilerError,
    releaseBufferedExecutions,
    resolveModule: ({ childProcess }) => {
      resolveModule({ data: childProcess.state.context.readinessData });
    },
    terminateBufferedExecutions,
  });

  const service = interpret(mainMachine);
  service.start();

  process.nextTick(() => {
    service.send('START');
  });

  return {
    execute: ({ args, executionId }) =>
      service.send('EXECUTE', { args, executionId }),
    fSWatcherReady: () =>
      service.state.context.fsWatcher.send('FS_WATCHER_READY'),
    fSWatcherStopped: () =>
      service.state.context.fsWatcher.send('FS_WATCHER_STOPPED'),
    killRequested: () => service.send('KILL_REQUESTED'),
    moduleChanged: () => service.send('MODULE_CHANGED'),
    processExited: ({ clean, transpilerError }) =>
      service.state.context.childProcess.send('CHILD_PROCESS_EXITED', {
        clean,
        transpilerError,
      }),
    ready: data =>
      service.state.context.childProcess.send('CHILD_PROCESS_READY', data),
    restartRequested: () => service.send('RESTART_REQUESTED'),
  };
};

module.exports = createState;
