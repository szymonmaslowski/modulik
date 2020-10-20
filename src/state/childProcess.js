const { assign, createMachine } = require('xstate');

const createChildProcessMachine = ({ startChildProcess, stopChildProcess }) =>
  createMachine({
    id: 'childProcess',
    context: {
      exitedCleanly: false,
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
            actions: assign({
              exitedCleanly: (_, event) => !!event.clean,
            }),
          },
        },
      },
      ready: {
        on: {
          CHILD_PROCESS_STOP_REQUESTED: 'stopping',
          CHILD_PROCESS_EXITED: {
            target: 'stopped',
            actions: assign({
              exitedCleanly: (_, event) => !!event.clean,
            }),
          },
        },
      },
      stopping: {
        entry: stopChildProcess,
        on: {
          CHILD_PROCESS_EXITED: {
            target: 'stopped',
            actions: assign({
              exitedCleanly: (_, event) => !!event.clean,
            }),
          },
        },
      },
      stopped: {},
    },
  });

module.exports = createChildProcessMachine;
