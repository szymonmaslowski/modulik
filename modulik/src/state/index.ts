import { interpret } from 'xstate';
import createChildProcessMachine from './childProcess';
import createFSWatcherMachine from './fsWatcher';
import createMainMachine from './main';
import { ExecutionId, ModuleBodyFunctionArgs } from '../types';
import {
  ArgAreThereExecutionsBuffered,
  ArgBufferExecution,
  ArgLogBufferedExecutionsTerminated,
  ArgLogCannotRestartKilledModule,
  ArgLogFailed,
  ArgLogReady,
  ArgLogRestarting,
  ArgLogTranspilerError,
  ArgNotifyKilled,
  ArgNotifyRestarted,
  ArgNotifyRestartFailed,
  ArgRecreateModulePromise,
  ArgRejectExecutionWithKilledModuleError,
  ArgRejectExecutionWithInvalidModuleTypeError,
  ArgRejectModuleWithAvailabilityError,
  ArgRejectModuleWithFailureError,
  ArgRejectModuleWithTranspilerError,
  ArgReleaseBufferedExecutions,
  ArgStartChildProcess,
  ArgStartFSWatcher,
  ArgStopChildProcess,
  ArgStopFSWatcher,
  ArgTerminateBufferedExecutions,
  ArgResolveModule,
  ArgRejectModuleWithSerializationError,
  ChildProcessEventType,
  FSWatcherEventType,
  MainEventType,
  ReadinessData,
} from './types';
import { ensureMachineIsValidAndCall } from './utils';

interface Args {
  areThereExecutionsBuffered: ArgAreThereExecutionsBuffered;
  bufferExecution: ArgBufferExecution;
  logBufferedExecutionsTerminated: ArgLogBufferedExecutionsTerminated;
  logCannotRestartKilledModule: ArgLogCannotRestartKilledModule;
  logFailed: ArgLogFailed;
  logReady: ArgLogReady;
  logRestarting: ArgLogRestarting;
  logTranspilerError: ArgLogTranspilerError;
  notifyKilled: ArgNotifyKilled;
  notifyRestarted: ArgNotifyRestarted;
  notifyRestartFailed: ArgNotifyRestartFailed;
  recreateModulePromise: ArgRecreateModulePromise;
  rejectExecutionWithKilledModuleError: ArgRejectExecutionWithKilledModuleError;
  rejectExecutionWithInvalidModuleTypeError: ArgRejectExecutionWithInvalidModuleTypeError;
  rejectModuleWithAvailabilityError: ArgRejectModuleWithAvailabilityError;
  rejectModuleWithFailureError: ArgRejectModuleWithFailureError;
  rejectModuleWithSerializationError: ArgRejectModuleWithSerializationError;
  rejectModuleWithTranspilerError: ArgRejectModuleWithTranspilerError;
  releaseBufferedExecutions: ArgReleaseBufferedExecutions;
  resolveModule: ArgResolveModule;
  startChildProcess: ArgStartChildProcess;
  startFSWatcher: ArgStartFSWatcher;
  stopChildProcess: ArgStopChildProcess;
  stopFSWatcher: ArgStopFSWatcher;
  terminateBufferedExecutions: ArgTerminateBufferedExecutions;
}

interface ApiExecuteArgs {
  args: ModuleBodyFunctionArgs;
  executionId: ExecutionId;
}

interface ApiProcessExitedArgs {
  clean: boolean;
  transpilerError: boolean;
}

type ApiReadyArgs = ReadinessData;

interface Api {
  execute: ({ args, executionId }: ApiExecuteArgs) => void;
  fSWatcherReady: () => void;
  fSWatcherStopped: () => void;
  killRequested: () => void;
  moduleChanged: () => void;
  processExited: ({ clean, transpilerError }: ApiProcessExitedArgs) => void;
  ready: (data: ApiReadyArgs) => void;
  restartRequested: () => void;
}

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
  rejectModuleWithSerializationError,
  rejectModuleWithTranspilerError,
  releaseBufferedExecutions,
  resolveModule,
  startChildProcess,
  startFSWatcher,
  stopChildProcess,
  stopFSWatcher,
  terminateBufferedExecutions,
}: Args): Api => {
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
    rejectModuleWithSerializationError,
    rejectModuleWithTranspilerError,
    releaseBufferedExecutions,
    resolveModule,
    terminateBufferedExecutions,
  });

  const service = interpret(mainMachine);
  service.start();

  process.nextTick(() => {
    service.send(MainEventType.start);
  });

  return {
    execute: ({ args, executionId }) =>
      service.send(MainEventType.execute, { args, executionId }),
    fSWatcherReady: () =>
      ensureMachineIsValidAndCall(service.state.context.fsWatcher, fsWatcher =>
        fsWatcher.send(FSWatcherEventType.ready),
      ),
    fSWatcherStopped: () =>
      ensureMachineIsValidAndCall(service.state.context.fsWatcher, fsWatcher =>
        fsWatcher.send(FSWatcherEventType.stopped),
      ),
    killRequested: () => service.send(MainEventType.killRequested),
    moduleChanged: () => service.send(MainEventType.moduleChanged),
    processExited: ({ clean, transpilerError }) =>
      ensureMachineIsValidAndCall(
        service.state.context.childProcess,
        childProcess =>
          childProcess.send({
            type: ChildProcessEventType.exited,
            data: {
              clean,
              transpilerError,
            },
          }),
      ),
    ready: data =>
      ensureMachineIsValidAndCall(
        service.state.context.childProcess,
        childProcess =>
          childProcess.send({
            type: ChildProcessEventType.ready,
            data,
          }),
      ),
    restartRequested: () => service.send(MainEventType.restartRequested),
  };
};

export default createState;
