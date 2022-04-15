import {
  ExecutionId,
  GenericModuleBodyFunctionArgs,
  ModuleType,
} from '../types';

export enum ChildProcessEventType {
  ready = 'ready',
  stopRequested = 'stopRequested',
  exited = 'exited',
}

export enum FSWatcherEventType {
  ready = 'ready',
  stopRequested = 'stopRequested',
  stopped = 'stopped',
}

export enum MainEventType {
  start = 'start',
  killRequested = 'killRequested',
  execute = 'execute',
  moduleChanged = 'moduleChanged',
  restartRequested = 'restartRequested',
}

export interface ReadinessData {
  body: any;
  serializable: boolean;
  type: ModuleType;
}

interface BufferExecutionArgs {
  args: GenericModuleBodyFunctionArgs;
  executionId: ExecutionId;
}

interface BufferExecutionArgs {
  args: GenericModuleBodyFunctionArgs;
  executionId: ExecutionId;
}

type ResolveModuleDataArg = ReadinessData;

interface ResolveModuleArgs {
  data: ResolveModuleDataArg;
}

interface RejectExecutionWithKilledModuleErrorArgs {
  executionId: ExecutionId;
}

interface RejectExecutionWithInvalidModuleTypeErrorArgs {
  executionId: ExecutionId;
  type: ModuleType;
}

export type ArgAreThereExecutionsBuffered = () => boolean;
export type ArgBufferExecution = (args: BufferExecutionArgs) => void;
export type ArgLogBufferedExecutionsTerminated = () => void;
export type ArgLogCannotRestartKilledModule = () => void;
export type ArgLogFailed = () => void;
export type ArgLogReady = () => void;
export type ArgLogRestarting = () => void;
export type ArgLogTranspilerError = () => void;
export type ArgNotifyKilled = () => void;
export type ArgNotifyRestarted = () => void;
export type ArgNotifyRestartFailed = () => void;
export type ArgRecreateModulePromise = () => void;
export type ArgRejectExecutionWithKilledModuleError = (
  args: RejectExecutionWithKilledModuleErrorArgs,
) => void;
export type ArgRejectExecutionWithInvalidModuleTypeError = (
  args: RejectExecutionWithInvalidModuleTypeErrorArgs,
) => void;
export type ArgRejectModuleWithAvailabilityError = () => void;
export type ArgRejectModuleWithFailureError = () => void;
export type ArgRejectModuleWithSerializationError = () => void;
export type ArgRejectModuleWithTranspilerError = () => void;
export type ArgReleaseBufferedExecutions = () => void;
export type ArgResolveModule = (args: ResolveModuleArgs) => void;
export type ArgStartChildProcess = () => void;
export type ArgStopChildProcess = () => void;
export type ArgStartFSWatcher = () => void;
export type ArgStopFSWatcher = () => void;
export type ArgTerminateBufferedExecutions = () => void;
