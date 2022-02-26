const { assign, createMachine } = require('xstate');

const createChildProcessMachine = ({ startChildProcess, stopChildProcess }) =>
  createMachine(
    {
      id: 'childProcess',
      context: {
        exitedCleanly: false,
        transpilerError: false,
        readinessData: null,
      },
      initial: 'starting',
      states: {
        starting: {
          entry: startChildProcess,
          on: {
            CHILD_PROCESS_READY: {
              target: 'ready',
              actions: assign({
                readinessData: (_, event) => event.data,
              }),
            },
            CHILD_PROCESS_STOP_REQUESTED: 'stopping',
            CHILD_PROCESS_EXITED: {
              target: 'stopped',
              actions: 'assignExitData',
            },
          },
        },
        ready: {
          on: {
            CHILD_PROCESS_STOP_REQUESTED: 'stopping',
            CHILD_PROCESS_EXITED: {
              target: 'stopped',
              actions: 'assignExitData',
            },
          },
        },
        stopping: {
          entry: stopChildProcess,
          on: {
            CHILD_PROCESS_EXITED: {
              target: 'stopped',
              actions: 'assignExitData',
            },
          },
        },
        stopped: {},
      },
    },
    {
      actions: {
        assignExitData: assign({
          exitedCleanly: (_, event) => !!event.clean,
          transpilerError: (_, event) => !!event.transpilerError,
        }),
      },
    },
  );

module.exports = createChildProcessMachine;
