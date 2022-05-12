import { interpret } from 'xstate';
import createChildProcessMachine from './childProcess';
import createFSWatcherMachine from './fsWatcher';
import createMainMachine from './main';
import { GenericModuleBodyFunctionArgs } from '../types';
import {
  ArgAreThereExecutionsBuffered,
  ArgBufferExecution,
  ArgClearRegisteredCallbacks,
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
  clearRegisteredCallbacks: ArgClearRegisteredCallbacks;
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
  args: GenericModuleBodyFunctionArgs;
  executionId: string;
  functionId: string;
}

interface ApiProcessExitedArgs {
  clean: boolean;
  transpilerError: boolean;
}

type ApiReadyArgs = ReadinessData;

const createState = ({
  areThereExecutionsBuffered,
  bufferExecution,
  clearRegisteredCallbacks,
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
}: Args) => {
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
    clearRegisteredCallbacks,
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
    execute: ({ args, executionId, functionId }: ApiExecuteArgs) => {
      service.send({
        type: MainEventType.execute,
        data: {
          args,
          executionId,
          functionId,
        },
      });
    },
    fSWatcherReady: () => {
      ensureMachineIsValidAndCall(service.state.context.fsWatcher, fsWatcher =>
        fsWatcher.send(FSWatcherEventType.ready),
      );
    },
    fSWatcherStopped: () => {
      ensureMachineIsValidAndCall(service.state.context.fsWatcher, fsWatcher =>
        fsWatcher.send(FSWatcherEventType.stopped),
      );
    },
    killRequested: () => {
      service.send(MainEventType.killRequested);
    },
    moduleChanged: () => {
      service.send(MainEventType.moduleChanged);
    },
    processExited: ({ clean, transpilerError }: ApiProcessExitedArgs) => {
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
      );
    },
    ready: (data: ApiReadyArgs) => {
      ensureMachineIsValidAndCall(
        service.state.context.childProcess,
        childProcess =>
          childProcess.send({
            type: ChildProcessEventType.ready,
            data,
          }),
      );
    },
    restartRequested: () => {
      service.send(MainEventType.restartRequested);
    },
  };
};

export default createState;
