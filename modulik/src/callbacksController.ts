import { v4 } from 'uuid';
import { callbackKeyName } from './constants';

const createArgumentsController = () => {
  const registeredCallbacks = new Map<string, Function>();

  const substituteCallbackWithItsRepresentation = (arg: any): any => {
    if (!(arg instanceof Function)) return arg;

    const callbackId = v4();
    registeredCallbacks.set(callbackId, arg);
    return `${callbackKeyName}:${callbackId}`;
  };

  const parseArguments = (args: any[]) =>
    args.map(arg => {
      if (Array.isArray(arg))
        return arg.map(substituteCallbackWithItsRepresentation);

      if (typeof arg === 'object')
        return Object.entries(arg).reduce((acc, [key, value]) => {
          acc[key] = substituteCallbackWithItsRepresentation(value);
          return acc;
        }, arg);

      return substituteCallbackWithItsRepresentation(arg);
    });

  const executeCallback = async (id: string, args: any[]) => {
    const callback = registeredCallbacks.get(id);
    if (!callback) {
      throw new Error('No such callback');
    }

    return callback(...args);
  };

  const clearRegisteredCallbacks = () => {
    registeredCallbacks.clear();
  };

  return {
    parseArguments,
    executeCallback,
    clearRegisteredCallbacks,
  };
};

export default createArgumentsController;
