import { EventObject, Typestate } from 'xstate/lib/types';
import { ActorRefFrom, StateMachine } from 'xstate';

const getMachineError = <C, S, E extends EventObject, T extends Typestate<C>>(
  machine: ActorRefFrom<StateMachine<C, S, E, T>> | null,
) => {
  if (machine === null) {
    return new Error('Machine is not available');
  }
  if (typeof machine.stop !== 'function') {
    return new Error('Machine is invalid');
  }

  throw new Error('Cannot find an machine error');
};

interface ObjectWithStopCallback {
  stop: () => void;
}

export const isMachineValid = <
  C,
  S,
  E extends EventObject,
  T extends Typestate<C>,
>(
  machine: ActorRefFrom<StateMachine<C, S, E, T>> | null,
): machine is ActorRefFrom<StateMachine<C, S, E, T>> & ObjectWithStopCallback =>
  machine !== null && typeof machine.stop === 'function';

export const ensureMachineIsValidAndCall = <
  C,
  S,
  E extends EventObject,
  T extends Typestate<C>,
  Result,
>(
  machine: ActorRefFrom<StateMachine<C, S, E, T>> | null,
  callback: (
    machine: ActorRefFrom<StateMachine<C, S, E, T>> & ObjectWithStopCallback,
  ) => Result,
) => {
  if (!isMachineValid(machine)) {
    throw getMachineError(machine);
  }
  return callback(machine);
};
