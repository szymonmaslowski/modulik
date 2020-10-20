import { inspect } from '@xstate/inspect';
import createState from '../../src/state';

inspect({
  iframe: false,
});

const socketServer = new WebSocket('ws://localhost:4000');
socketServer.addEventListener('open', () => {
  let state;

  const updateStates = () => {
    const states = ['isStarting', 'isAccessible', 'isKilled']
      .map(name => ({
        name,
        value: state[name](),
      }))
      .reduce((acc, { name, value }) => {
        acc[name] = value;
        return acc;
      }, {});

    socketServer.send(
      JSON.stringify({
        type: 'states',
        states,
      }),
    );
  };

  const callbacks = [
    'recreateModulePromise',
    'resolveModule',
    'rejectModuleWithFailureError',
    'rejectModuleWithAvailabilityError',
    'handlePendingExecutions',
    'startFSWatcher',
    'stopFSWatcher',
    'startChildProcess',
    'stopChildProcess',
    'notifyKilled',
    'logReady',
    'logRestarting',
    'logFailed',
    'logCannotRestartKilledModule',
  ].reduce((acc, name) => {
    acc[name] = (...args) => {
      updateStates();
      socketServer.send(
        JSON.stringify({
          type: 'callback',
          name,
          args,
        }),
      );
      updateStates();
    };
    return acc;
  }, {});

  state = createState(callbacks);

  socketServer.addEventListener('message', event => {
    const { name, args } = JSON.parse(event.data);
    if (!state[name]) {
      throw new Error(`Invalid command name ${name}`);
    }

    updateStates();
    state[name](...args);
    updateStates();
  });

  updateStates();
  setInterval(updateStates, 100);
});
