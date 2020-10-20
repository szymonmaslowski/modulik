const { createMachine } = require('xstate');

const createFSWatcherMachine = ({ startFSWatcher, stopFSWatcher }) =>
  createMachine({
    id: 'fsWatcher',
    initial: 'starting',
    context: {
      changeRegistered: false,
    },
    states: {
      starting: {
        entry: startFSWatcher,
        on: {
          FS_WATCHER_READY: 'ready',
          FS_WATCHER_STOP_REQUESTED: 'stopping',
        },
      },
      ready: {
        on: {
          FS_WATCHER_STOP_REQUESTED: 'stopping',
        },
      },
      stopping: {
        entry: stopFSWatcher,
        on: {
          FS_WATCHER_STOPPED: 'stopped',
        },
      },
      stopped: {},
    },
  });

module.exports = createFSWatcherMachine;
