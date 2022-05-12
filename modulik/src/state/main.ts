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
import { GenericModuleBodyFunctionArgs } from '../types';
import {
  doesModuleHaveAnyNamedExportedFunction,
  getNamedExportedFunctionsFromModule,
  isEntityAFunctionRepresentation,
} from '../utils';
import { ChildProcessMachine } from './childProcess';
import { FSWatcherMachine } from './fsWatcher';
import { ensureMachineIsValidAndCall, isMachineValid } from './utils';
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
  lastExportedFunctionIds: string[];
}

interface EventStart {
  type: MainEventType.start;
}

interface EventKillRequested {
  type: MainEventType.killRequested;
}

interface EventExecuteData {
  args: GenericModuleBodyFunctionArgs;
  executionId: string;
  functionId: string;
}

interface EventExecute {
  type: MainEventType.execute;
  data: EventExecuteData;
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

enum RestartingStateChildState {
  log = 'log',
  wait = 'wait',
}

enum KillingStateChildState {
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
    | { [MainState.restarting]: RestartingStateChildState }
    | { [MainState.killing]: KillingStateChildState };
  context: MainContext & {
    childProcess: ChildProcessContextProperty;
    fsWatcher: FSWatcherContextProperty;
  };
}

type MainTypestate = StateIdle | StateSetup | StateOtherThanIdleOrSetup;

interface Args {
  areThereExecutionsBuffered: ArgAreThereExecutionsBuffered;
  bufferExecution: ArgBufferExecution;
  clearRegisteredCallbacks: ArgClearRegisteredCallbacks;
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

const makeRestartingChildState = (childState: RestartingStateChildState) =>
  `${MainState.restarting}.${childState}`;

const makeKillingChildState = (childState: KillingStateChildState) =>
  `${MainState.killing}.${childState}`;

const isState = <C, E extends EventObject, S, T extends Typestate<C>, R>(
  state: State<C, E, S, T, R>,
  ...names: string[]
) => names.some(name => state.toStrings().includes(name));

const createMainMachine = ({
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
}: Args) =>
  createMachine<MainContext, MainEvent, MainTypestate>({
    id: 'main',
    initial: 'idle',
    context: {
      fsWatcher: null,
      childProcess: null,
      lastExportedFunctionIds: [],
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
            target: makeKillingChildState(KillingStateChildState.fsWatcher),
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
              pure((_, { data: { args, executionId, functionId } }) => {
                bufferExecution({ args, executionId, functionId });
              }),
            ],
          },
          [MainEventType.moduleChanged]: makeRestartingChildState(
            RestartingStateChildState.wait,
          ),
          [MainEventType.restartRequested]: makeRestartingChildState(
            RestartingStateChildState.wait,
          ),
          [MainEventType.killRequested]: {
            target: MainState.killing,
            actions: rejectModuleWithAvailabilityError,
          },
        },
      },
      [MainState.accessible]: {
        exit: [pure(clearRegisteredCallbacks)],
        initial: 'handleBufferedExecutions',
        states: {
          handleBufferedExecutions: {
            entry: pure((ctx: MainContext) =>
              ensureMachineIsValidAndCall(ctx.childProcess, childProcess => {
                if (!areThereExecutionsBuffered()) return;

                const { readinessData } = childProcess.state.context;
                if (!readinessData) {
                  throw new Error('Readiness data not available');
                }

                const { body } = readinessData;
                let executionsToTerminate = ctx.lastExportedFunctionIds;

                if (isEntityAFunctionRepresentation(body)) {
                  releaseBufferedExecutions({ functionId: 'default' });
                  executionsToTerminate = ctx.lastExportedFunctionIds.filter(
                    functionId => functionId !== 'default',
                  );
                } else if (doesModuleHaveAnyNamedExportedFunction(body)) {
                  getNamedExportedFunctionsFromModule(body).forEach(
                    ({ name: functionId }) =>
                      releaseBufferedExecutions({ functionId }),
                  );

                  const allExportedFunctionsNamesAndDefault =
                    getNamedExportedFunctionsFromModule(body)
                      .map(({ name }) => name)
                      .concat('default');
                  executionsToTerminate = ctx.lastExportedFunctionIds.filter(
                    functionId =>
                      !allExportedFunctionsNamesAndDefault.includes(functionId),
                  );
                }

                if (!executionsToTerminate.length) return;

                executionsToTerminate.forEach(functionId =>
                  terminateBufferedExecutions({ functionId }),
                );
                logBufferedExecutionsTerminated();
              }),
            ),
            always: 'handleModuleBody',
          },
          handleModuleBody: {
            entry: pure((ctx: MainContext) =>
              ensureMachineIsValidAndCall(ctx.childProcess, childProcess => {
                const { readinessData } = childProcess.state.context;
                if (!readinessData) {
                  throw new Error('Readiness data not available');
                }

                const { serializable, body } = readinessData;

                if (!isEntityAFunctionRepresentation(body) && !serializable) {
                  rejectModuleWithSerializationError();
                  return;
                }

                resolveModule({ body });
                logReady();
              }),
            ),
            always: 'storeLastExportedFunctionIds',
          },
          storeLastExportedFunctionIds: {
            entry: assign({
              lastExportedFunctionIds: ctx =>
                ensureMachineIsValidAndCall(ctx.childProcess, childProcess => {
                  const { readinessData } = childProcess.state.context;
                  if (!readinessData) {
                    throw new Error('Readiness data not available');
                  }
                  const { body } = readinessData;

                  if (isEntityAFunctionRepresentation(body)) {
                    return ['default'];
                  }
                  if (doesModuleHaveAnyNamedExportedFunction(body)) {
                    return getNamedExportedFunctionsFromModule(body).map(
                      ({ name }) => name,
                    );
                  }
                  return [];
                }),
            }),
          },
        },
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
            actions: pure((ctx, { data: { args, executionId, functionId } }) =>
              ensureMachineIsValidAndCall(ctx.childProcess, childProcess => {
                const { readinessData } = childProcess.state.context;
                if (!readinessData) {
                  throw new Error('Readiness data not available');
                }

                const { body } = readinessData;

                const shouldReject =
                  functionId === 'default'
                    ? !isEntityAFunctionRepresentation(body)
                    : !(function checkIfFunctionIdMatchesNamedExportedFunction() {
                        return (
                          doesModuleHaveAnyNamedExportedFunction(body) &&
                          Boolean(
                            getNamedExportedFunctionsFromModule(body).find(
                              ({ name }) => name === functionId,
                            ),
                          )
                        );
                      })();

                if (shouldReject) {
                  rejectExecutionWithInvalidModuleTypeError({
                    executionId,
                    type: typeof (functionId === 'default'
                      ? body
                      : body[functionId]),
                  });
                  return;
                }

                bufferExecution({ args, executionId, functionId });
                releaseBufferedExecutions({ functionId });
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
        initial: RestartingStateChildState.log,
        states: {
          [RestartingStateChildState.log]: {
            entry: pure(logRestarting),
            always: RestartingStateChildState.wait,
          },
          [RestartingStateChildState.wait]: {},
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
              pure((_, { data: { args, executionId, functionId } }) => {
                bufferExecution({ args, executionId, functionId });
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
              pure((_, { data: { args, executionId, functionId } }) => {
                bufferExecution({ args, executionId, functionId });
              }),
            ],
          },
          [MainEventType.moduleChanged]: MainState.restarting,
          [MainEventType.restartRequested]: MainState.restarting,
          [MainEventType.killRequested]: MainState.killing,
        },
      },
      [MainState.killing]: {
        initial: KillingStateChildState.childProcess,
        states: {
          [KillingStateChildState.childProcess]: {
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
            always: KillingStateChildState.fsWatcher,
          },
          [KillingStateChildState.fsWatcher]: {
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
            actions: pure((_, { data: { executionId } }) => {
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
            actions: pure((_, { data: { executionId } }) => {
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
