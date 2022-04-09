import { assign, createMachine } from 'xstate';
import {
  ArgStartChildProcess,
  ArgStopChildProcess,
  ReadinessData,
} from './types';

interface ChildProcessContext {
  exitedCleanly: boolean;
  transpilerError: boolean;
  readinessData: ReadinessData | null;
}

export enum ChildProcessEventType {
  ready = 'ready',
  stopRequested = 'stopRequested',
  exited = 'exited',
}

interface EventExitedData {
  clean: boolean;
  transpilerError: boolean;
}

interface EventExited {
  type: ChildProcessEventType.exited;
  data: EventExitedData;
}

interface EventReady {
  type: ChildProcessEventType.ready;
  data: ReadinessData;
}

interface EventStopRequested {
  type: ChildProcessEventType.stopRequested;
}

export type ChildProcessEvent = EventReady | EventStopRequested | EventExited;

enum ChildProcessState {
  starting = 'starting',
  ready = 'ready',
  stopping = 'stopping',
  stopped = 'stopped',
}

interface ChildProcessTypestate {
  value: ChildProcessState.starting;
  context: ChildProcessContext;
}

interface Args {
  startChildProcess: ArgStartChildProcess;
  stopChildProcess: ArgStopChildProcess;
}

export type ChildProcessMachine = ReturnType<typeof createChildProcessMachine>;

const createChildProcessMachine = ({
  startChildProcess,
  stopChildProcess,
}: Args) => {
  const assignExitData = assign<ChildProcessContext, EventExited>({
    exitedCleanly: (_, event) => event.data.clean,
    transpilerError: (_, event) => event.data.transpilerError,
  });

  return createMachine<
    ChildProcessContext,
    ChildProcessEvent,
    ChildProcessTypestate
  >({
    id: 'childProcess',
    context: {
      exitedCleanly: false,
      transpilerError: false,
      readinessData: null,
    },
    initial: ChildProcessState.starting,
    states: {
      [ChildProcessState.starting]: {
        entry: startChildProcess,
        on: {
          [ChildProcessEventType.ready]: {
            target: 'ready',
            actions: assign({
              readinessData: (_, event) => event.data,
            }),
          },
          [ChildProcessEventType.stopRequested]: ChildProcessState.stopping,
          [ChildProcessEventType.exited]: {
            target: ChildProcessState.stopped,
            actions: assignExitData,
          },
        },
      },
      [ChildProcessState.ready]: {
        on: {
          [ChildProcessEventType.stopRequested]: ChildProcessState.stopping,
          [ChildProcessEventType.exited]: {
            target: ChildProcessState.stopped,
            actions: assignExitData,
          },
        },
      },
      [ChildProcessState.stopping]: {
        entry: stopChildProcess,
        on: {
          [ChildProcessEventType.exited]: {
            target: ChildProcessState.stopped,
            actions: assignExitData,
          },
        },
      },
      [ChildProcessState.stopped]: {},
    },
  });
};

export default createChildProcessMachine;
