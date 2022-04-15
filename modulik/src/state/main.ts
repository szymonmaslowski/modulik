import {
  createMachine,
  assign,
  send,
  spawn,
  actions,
  ActorRefFrom,
  State,
} from 'xstate';
import { EventObject, Typestate } from 'xstate/lib/types';
import { ExecutionId, GenericModuleBodyFunctionArgs } from '../types';
import { ChildProcessMachine } from './childProcess';
import { FSWatcherMachine } from './fsWatcher';
import { ensureMachineIsValidAndCall, isMachineValid } from './utils';
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
  ArgRejectExecutionWithInvalidModuleTypeError,
  ArgRejectExecutionWithKilledModuleError,
  ArgRejectModuleWithAvailabilityError,
  ArgRejectModuleWithFailureError,
  ArgRejectModuleWithSerializationError,
  ArgRejectModuleWithTranspilerError,
  ArgReleaseBufferedExecutions,
  ArgResolveModule,
  ArgTerminateBufferedExecutions,
  ChildProcessEventType,
  FSWatcherEventType,
  MainEventType,
} from './types';

const { pure } = actions;

type ChildProcessContextProperty = ActorRefFrom<ChildProcessMachine>;
type FSWatcherContextProperty = ActorRefFrom<FSWatcherMachine>;

interface MainContext {
  childProcess: ChildProcessContextProperty | null;
  fsWatcher: FSWatcherContextProperty | null;
}

interface EventStart {
  type: MainEventType.start;
}

interface EventKillRequested {
  type: MainEventType.killRequested;
}

interface EventExecute {
  type: MainEventType.execute;
  args: GenericModuleBodyFunctionArgs;
  executionId: ExecutionId;
}

interface EventModuleChanged {
  type: MainEventType.moduleChanged;
}

interface EventRestartRequested {
  type: MainEventType.restartRequested;
}

type MainEvent =
  | EventStart
  | EventKillRequested
  | EventExecute
  | EventModuleChanged
  | EventRestartRequested;

enum StateRestartingChildState {
  log = 'log',
  wait = 'wait',
}

enum StateKillingChildState {
  childProcess = 'childProcess',
  fsWatcher = 'fsWatcher',
}

enum MainState {
  idle = 'idle',
  setup = 'setup',
  starting = 'starting',
  accessible = 'accessible',
  restarting = 'restarting',
  failed = 'failed',
  killing = 'killing',
  killed = 'killed',
}

interface StateIdle {
  value: MainState.idle;
  context: MainContext & {
    childProcess: null;
    fsWatcher: null;
  };
}

interface StateSetup {
  value: MainState.setup;
  context: MainContext & {
    childProcess: null;
    fsWatcher: FSWatcherContextProperty;
  };
}

interface StateOtherThanIdleOrSetup {
  value:
    | Exclude<MainState, MainState.idle | MainState.setup>
    | { [MainState.restarting]: StateRestartingChildState }
    | { [MainState.killing]: StateKillingChildState };
  context: MainContext & {
    childProcess: ChildProcessContextProperty;
    fsWatcher: FSWatcherContextProperty;
  };
}

type MainTypestate = StateIdle | StateSetup | StateOtherThanIdleOrSetup;

interface Args {
  areThereExecutionsBuffered: ArgAreThereExecutionsBuffered;
  bufferExecution: ArgBufferExecution;
  childProcessMachine: ChildProcessMachine;
  fsWatcherMachine: FSWatcherMachine;
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
  terminateBufferedExecutions: ArgTerminateBufferedExecutions;
}

const makeRestartingChildState = (childState: StateRestartingChildState) =>
  `${MainState.restarting}.${childState}`;

const makeKillingChildState = (childState: StateKillingChildState) =>
  `${MainState.killing}.${childState}`;

const isState = <C, E extends EventObject, S, T extends Typestate<C>, R>(
  state: State<C, E, S, T, R>,
  ...names: string[]
) => names.some(name => state.toStrings().includes(name));

const createMainMachine = ({
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
}: Args) =>
  createMachine<MainContext, MainEvent, MainTypestate>({
    id: 'main',
    initial: 'idle',
    context: {
      fsWatcher: null,
      childProcess: null,
    },
    states: {
      [MainState.idle]: {
        on: {
          [MainEventType.start]: MainState.setup,
          [MainEventType.killRequested]: {
            target: MainState.killed,
            actions: rejectModuleWithAvailabilityError,
          },
        },
      },
      [MainState.setup]: {
        entry: assign({
          fsWatcher: () =>
            spawn(fsWatcherMachine, { name: 'fsWatcher', sync: true }),
        }),
        always: {
          target: MainState.starting,
          cond: ctx =>
            ensureMachineIsValidAndCall(ctx.fsWatcher, fsWatcher =>
              isState(fsWatcher.state, 'ready'),
            ),
        },
        on: {
          [MainEventType.killRequested]: {
            target: makeKillingChildState(StateKillingChildState.fsWatcher),
            actions: rejectModuleWithAvailabilityError,
          },
        },
      },
      [MainState.starting]: {
        entry: [
          assign({
            childProcess: ctx => {
              if (isMachineValid(ctx.childProcess)) {
                ctx.childProcess.stop();
              }
              return spawn(childProcessMachine, {
                name: 'childProcess',
                sync: true,
              });
            },
          }),
        ],
        always: [
          {
            target: MainState.failed,
            cond: ctx =>
              ensureMachineIsValidAndCall(
                ctx.childProcess,
                childProcess =>
                  isState(childProcess.state, 'stopped') &&
                  !childProcess.state.context.exitedCleanly,
              ),
          },
          {
            target: MainState.accessible,
            cond: ctx =>
              ensureMachineIsValidAndCall(ctx.childProcess, childProcess =>
                isState(childProcess.state, 'ready'),
              ),
          },
        ],
        on: {
          [MainEventType.execute]: {
            actions: [
              pure((_, { args, executionId }) => {
                bufferExecution({ args, executionId });
              }),
            ],
          },
          [MainEventType.moduleChanged]: makeRestartingChildState(
            StateRestartingChildState.wait,
          ),
          [MainEventType.restartRequested]: makeRestartingChildState(
            StateRestartingChildState.wait,
          ),
          [MainEventType.killRequested]: {
            target: MainState.killing,
            actions: rejectModuleWithAvailabilityError,
          },
        },
      },
      [MainState.accessible]: {
        entry: [
          pure((ctx: MainContext) =>
            ensureMachineIsValidAndCall(ctx.childProcess, childProcess => {
              if (!areThereExecutionsBuffered()) return;

              const { readinessData } = childProcess.state.context;
              if (!readinessData) {
                throw new Error('Readiness data not available');
              }

              if (readinessData.type === 'function') {
                releaseBufferedExecutions();
                return;
              }

              terminateBufferedExecutions();
              logBufferedExecutionsTerminated();
            }),
          ),
          pure((ctx: MainContext) =>
            ensureMachineIsValidAndCall(ctx.childProcess, childProcess => {
              const { readinessData } = childProcess.state.context;
              if (!readinessData) {
                throw new Error('Readiness data not available');
              }

              const { serializable, type } = readinessData;

              if (type !== 'function' && !serializable) {
                rejectModuleWithSerializationError();
                return;
              }

              resolveModule({ data: readinessData });
              logReady();
            }),
          ),
        ],
        always: [
          {
            target: MainState.failed,
            cond: ctx =>
              ensureMachineIsValidAndCall(
                ctx.childProcess,
                childProcess =>
                  isState(childProcess.state, 'stopped') &&
                  !childProcess.state.context.exitedCleanly,
              ),
          },
        ],
        on: {
          [MainEventType.execute]: {
            actions: pure((ctx, { args, executionId }) =>
              ensureMachineIsValidAndCall(ctx.childProcess, childProcess => {
                const { readinessData } = childProcess.state.context;
                if (!readinessData) {
                  throw new Error('Readiness data not available');
                }

                if (readinessData.type !== 'function') {
                  rejectExecutionWithInvalidModuleTypeError({
                    executionId,
                    type: readinessData.type,
                  });
                  return;
                }

                bufferExecution({ args, executionId });
                releaseBufferedExecutions();
              }),
            ),
          },
          [MainEventType.moduleChanged]: MainState.restarting,
          [MainEventType.restartRequested]: MainState.restarting,
          [MainEventType.killRequested]: MainState.killing,
        },
      },
      [MainState.restarting]: {
        entry: [
          pure<MainContext, MainEvent>(ctx =>
            ensureMachineIsValidAndCall(ctx.childProcess, childProcess => {
              if (!isState(childProcess.state, 'starting', 'ready')) {
                return undefined;
              }

              return send(ChildProcessEventType.stopRequested, {
                to: 'childProcess',
              });
            }),
          ),
          pure(recreateModulePromise),
        ],
        initial: StateRestartingChildState.log,
        states: {
          [StateRestartingChildState.log]: {
            entry: pure(logRestarting),
            always: StateRestartingChildState.wait,
          },
          [StateRestartingChildState.wait]: {},
        },
        always: [
          {
            target: MainState.failed,
            actions: pure(notifyRestartFailed),
            cond: ctx =>
              ensureMachineIsValidAndCall(
                ctx.childProcess,
                childProcess =>
                  isState(childProcess.state, 'stopped') &&
                  !!childProcess.state.context.readinessData &&
                  !childProcess.state.context.exitedCleanly,
              ),
          },
          {
            target: MainState.starting,
            actions: pure(notifyRestarted),
            cond: ctx =>
              ensureMachineIsValidAndCall(ctx.childProcess, childProcess =>
                isState(childProcess.state, 'stopped'),
              ),
          },
        ],
        on: {
          [MainEventType.execute]: {
            actions: [
              pure((_, { args, executionId }) => {
                bufferExecution({ args, executionId });
              }),
            ],
          },
          [MainEventType.killRequested]: {
            target: MainState.killing,
            actions: rejectModuleWithAvailabilityError,
          },
        },
      },
      [MainState.failed]: {
        entry: [
          pure((ctx: MainContext) =>
            ensureMachineIsValidAndCall(ctx.childProcess, childProcess =>
              childProcess.state.context.transpilerError
                ? logTranspilerError()
                : logFailed(),
            ),
          ),
          pure((ctx: MainContext) =>
            ensureMachineIsValidAndCall(ctx.childProcess, childProcess =>
              childProcess.state.context.transpilerError
                ? rejectModuleWithTranspilerError()
                : rejectModuleWithFailureError(),
            ),
          ),
        ],
        on: {
          [MainEventType.execute]: {
            actions: [
              pure((_, { args, executionId }) => {
                bufferExecution({ args, executionId });
              }),
            ],
          },
          [MainEventType.moduleChanged]: MainState.restarting,
          [MainEventType.restartRequested]: MainState.restarting,
          [MainEventType.killRequested]: MainState.killing,
        },
      },
      [MainState.killing]: {
        initial: StateKillingChildState.childProcess,
        states: {
          [StateKillingChildState.childProcess]: {
            entry: [
              pure<MainContext, MainEvent>((ctx: MainContext) =>
                ensureMachineIsValidAndCall(ctx.childProcess, childProcess => {
                  if (!isState(childProcess.state, 'starting', 'ready')) {
                    return undefined;
                  }
                  return send(ChildProcessEventType.stopRequested, {
                    to: 'childProcess',
                  });
                }),
              ),
            ],
            always: StateKillingChildState.fsWatcher,
          },
          [StateKillingChildState.fsWatcher]: {
            entry: pure(() =>
              send(FSWatcherEventType.stopRequested, { to: 'fsWatcher' }),
            ),
          },
        },
        always: {
          target: MainState.killed,
          cond: ctx =>
            ensureMachineIsValidAndCall(ctx.fsWatcher, fsWatcher =>
              isState(fsWatcher.state, 'stopped'),
            ) &&
            (isMachineValid(ctx.childProcess)
              ? isState(ctx.childProcess.state, 'stopped')
              : true),
        },
        on: {
          [MainEventType.execute]: {
            actions: pure((_, { executionId }) => {
              rejectExecutionWithKilledModuleError({ executionId });
            }),
          },
          [MainEventType.restartRequested]: {
            actions: [
              pure(logCannotRestartKilledModule),
              pure(notifyRestarted),
            ],
          },
        },
      },
      [MainState.killed]: {
        entry: [
          pure(notifyKilled),
          pure((ctx: MainContext) => {
            if (!isMachineValid(ctx.childProcess)) return;
            ctx.childProcess.stop();
          }),
          pure((ctx: MainContext) => {
            if (!isMachineValid(ctx.fsWatcher)) return;
            ctx.fsWatcher.stop();
          }),
        ],
        on: {
          [MainEventType.execute]: {
            actions: pure((_, { executionId }) => {
              rejectExecutionWithKilledModuleError({ executionId });
            }),
          },
          [MainEventType.restartRequested]: {
            actions: [
              pure(logCannotRestartKilledModule),
              pure(notifyRestarted),
            ],
          },
        },
      },
    },
  });

export default createMainMachine;
