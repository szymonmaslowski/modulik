const { createMachine, assign, send, spawn, actions } = require('xstate');

const { pure } = actions;

const isState = (state, ...names) =>
  names.some(name => state.toStrings().includes(name));

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
  notifyKilled,
  notifyRestarted,
  notifyRestartFailed,
  recreateModulePromise,
  rejectExecutionWithKilledModuleError,
  rejectExecutionWithInvalidModuleTypeError,
  rejectModuleWithAvailabilityError,
  rejectModuleWithFailureError,
  releaseBufferedExecutions,
  resolveModule,
  terminateBufferedExecutions,
}) =>
  createMachine({
    id: 'main',
    initial: 'idle',
    context: {
      fsWatcher: null,
      childProcess: null,
    },
    states: {
      idle: {
        on: {
          START: 'setup',
          KILL_REQUESTED: {
            target: 'killed',
            actions: rejectModuleWithAvailabilityError,
          },
        },
      },
      setup: {
        entry: assign({
          fsWatcher: () =>
            spawn(fsWatcherMachine, { name: 'fsWatcher', sync: true }),
        }),
        always: {
          target: 'starting',
          cond: ctx => isState(ctx.fsWatcher.state, 'ready'),
        },
        on: {
          KILL_REQUESTED: {
            target: 'killing.fsWatcher',
            actions: rejectModuleWithAvailabilityError,
          },
        },
      },
      starting: {
        entry: [
          assign({
            childProcess: ctx => {
              if (ctx.childProcess) {
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
            target: 'failed',
            cond: ctx =>
              isState(ctx.childProcess.state, 'stopped') &&
              !ctx.childProcess.state.context.exitedCleanly,
          },
          {
            target: 'accessible',
            cond: ctx => isState(ctx.childProcess.state, 'ready'),
          },
        ],
        on: {
          EXECUTE: {
            actions: [
              pure((_, { args, executionId }) => {
                bufferExecution({ args, executionId });
              }),
            ],
          },
          MODULE_CHANGED: 'restarting.wait',
          RESTART_REQUESTED: 'restarting.wait',
          KILL_REQUESTED: {
            target: 'killing',
            actions: rejectModuleWithAvailabilityError,
          },
        },
      },
      accessible: {
        entry: [
          pure(ctx => {
            if (!areThereExecutionsBuffered()) return;

            const { type } = ctx.childProcess.state.context.readinessData;
            if (type === 'function') {
              releaseBufferedExecutions();
              return;
            }

            terminateBufferedExecutions();
            logBufferedExecutionsTerminated();
          }),
          pure(resolveModule),
          pure(logReady),
        ],
        always: [
          {
            target: 'failed',
            cond: ctx =>
              isState(ctx.childProcess.state, 'stopped') &&
              !ctx.childProcess.state.context.exitedCleanly,
          },
        ],
        on: {
          EXECUTE: {
            actions: pure((ctx, { args, executionId }) => {
              const { type } = ctx.childProcess.state.context.readinessData;
              if (type !== 'function') {
                rejectExecutionWithInvalidModuleTypeError({
                  executionId,
                  type,
                });
                return;
              }

              bufferExecution({ args, executionId });
              releaseBufferedExecutions();
            }),
          },
          MODULE_CHANGED: 'restarting',
          RESTART_REQUESTED: 'restarting',
          KILL_REQUESTED: 'killing',
        },
      },
      restarting: {
        entry: [
          pure(ctx => {
            if (!isState(ctx.childProcess.state, 'starting', 'ready')) {
              return undefined;
            }
            return send('CHILD_PROCESS_STOP_REQUESTED', {
              to: 'childProcess',
            });
          }),
          pure(recreateModulePromise),
        ],
        initial: 'log',
        states: {
          log: {
            entry: pure(logRestarting),
            always: 'wait',
          },
          wait: {},
        },
        always: [
          {
            target: '#main.failed',
            actions: pure(notifyRestartFailed),
            cond: ctx =>
              isState(ctx.childProcess.state, 'stopped') &&
              ctx.childProcess.state.context.readinessData &&
              !ctx.childProcess.state.context.exitedCleanly,
          },
          {
            target: '#main.starting',
            actions: pure(notifyRestarted),
            cond: ctx => isState(ctx.childProcess.state, 'stopped'),
          },
        ],
        on: {
          EXECUTE: {
            actions: [
              pure((_, { args, executionId }) => {
                bufferExecution({ args, executionId });
              }),
            ],
          },
          KILL_REQUESTED: {
            target: '#main.killing',
            actions: rejectModuleWithAvailabilityError,
          },
        },
      },
      failed: {
        entry: [pure(logFailed), pure(rejectModuleWithFailureError)],
        on: {
          EXECUTE: {
            actions: [
              pure((_, { args, executionId }) => {
                bufferExecution({ args, executionId });
              }),
            ],
          },
          MODULE_CHANGED: 'restarting',
          RESTART_REQUESTED: 'restarting',
          KILL_REQUESTED: 'killing',
        },
      },
      killing: {
        initial: 'childProcess',
        states: {
          childProcess: {
            entry: [
              pure(ctx => {
                if (!isState(ctx.childProcess.state, 'starting', 'ready')) {
                  return undefined;
                }
                return send('CHILD_PROCESS_STOP_REQUESTED', {
                  to: 'childProcess',
                });
              }),
            ],
            always: 'fsWatcher',
          },
          fsWatcher: {
            entry: pure(() =>
              send('FS_WATCHER_STOP_REQUESTED', { to: 'fsWatcher' }),
            ),
          },
        },
        always: {
          target: 'killed',
          cond: ctx =>
            isState(ctx.fsWatcher.state, 'stopped') &&
            (ctx.childProcess
              ? isState(ctx.childProcess.state, 'stopped')
              : true),
        },
        on: {
          EXECUTE: {
            actions: pure((_, { executionId }) => {
              rejectExecutionWithKilledModuleError({ executionId });
            }),
          },
          RESTART_REQUESTED: {
            actions: [
              pure(logCannotRestartKilledModule),
              pure(notifyRestarted),
            ],
          },
        },
      },
      killed: {
        entry: [
          pure(notifyKilled),
          pure(ctx => {
            if (!ctx.childProcess) return;
            ctx.childProcess.stop();
          }),
          pure(ctx => {
            if (!ctx.childProcess) return;
            ctx.fsWatcher.stop();
          }),
        ],
        on: {
          EXECUTE: {
            actions: pure((_, { executionId }) => {
              rejectExecutionWithKilledModuleError({ executionId });
            }),
          },
          RESTART_REQUESTED: {
            actions: [
              pure(logCannotRestartKilledModule),
              pure(notifyRestarted),
            ],
          },
        },
      },
    },
  });

module.exports = createMainMachine;
