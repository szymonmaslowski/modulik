import { inspect } from '@xstate/inspect';
import createState from '../../modulik/src/state';

inspect({
  iframe: false,
});

const socketServer = new WebSocket('ws://localhost:4444');
socketServer.addEventListener('open', () => {
  const callbacks = [
    'areThereExecutionsBuffered',
    'bufferExecution',
    'logBufferedExecutionsTerminated',
    'logCannotRestartKilledModule',
    'logFailed',
    'logReady',
    'logRestarting',
    'notifyKilled',
    'notifyRestarted',
    'notifyRestartFailed',
    'recreateModulePromise',
    'rejectExecutionWithKilledModuleError',
    'rejectExecutionWithInvalidModuleTypeError',
    'rejectModuleWithAvailabilityError',
    'rejectModuleWithFailureError',
    'releaseBufferedExecutions',
    'resolveModule',
    'startFSWatcher',
    'stopFSWatcher',
    'startChildProcess',
    'stopChildProcess',
    'terminateBufferedExecutions',
  ].reduce((acc, name) => {
    acc[name] = (...args) => {
      socketServer.send(
        JSON.stringify({
          name,
          args,
        }),
      );
    };
    return acc;
  }, {});

  const state = createState(callbacks);

  socketServer.addEventListener('message', event => {
    const { name, args } = JSON.parse(event.data);
    if (!state[name]) {
      throw new Error(`Invalid command name ${name}`);
    }

    state[name](...args);
  });
});
