import { createMachine } from 'xstate';
import {
  ArgStartFSWatcher,
  ArgStopFSWatcher,
  FSWatcherEventType,
} from './types';

interface FSWatcherEvent {
  type: FSWatcherEventType;
}

enum FSWatcherState {
  starting = 'starting',
  ready = 'ready',
  stopping = 'stopping',
  stopped = 'stopped',
}

interface FSWatcherTypestate {
  value: FSWatcherState;
  context: any;
}

interface Args {
  startFSWatcher: ArgStartFSWatcher;
  stopFSWatcher: ArgStopFSWatcher;
}

export type FSWatcherMachine = ReturnType<typeof createFSWatcherMachine>;

const createFSWatcherMachine = ({ startFSWatcher, stopFSWatcher }: Args) =>
  createMachine<any, FSWatcherEvent, FSWatcherTypestate>({
    id: 'fsWatcher',
    initial: FSWatcherState.starting,
    states: {
      [FSWatcherState.starting]: {
        entry: startFSWatcher,
        on: {
          [FSWatcherEventType.ready]: FSWatcherState.ready,
          [FSWatcherEventType.stopRequested]: FSWatcherState.stopping,
        },
      },
      [FSWatcherState.ready]: {
        on: {
          [FSWatcherEventType.stopRequested]: FSWatcherState.stopping,
        },
      },
      [FSWatcherState.stopping]: {
        entry: stopFSWatcher,
        on: {
          [FSWatcherEventType.stopped]: FSWatcherState.stopped,
        },
      },
      [FSWatcherState.stopped]: {},
    },
  });

export default createFSWatcherMachine;
