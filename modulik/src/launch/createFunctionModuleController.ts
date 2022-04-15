import { v4 } from 'uuid';
import {
  GenericModuleBodyFunctionArgs,
  FunctionModuleBodyArgs,
  FunctionModuleBodyResult,
  PromiseActions,
} from '../types';

interface FunctionModuleExecutionCallbackArgs {
  id: string;
  args: GenericModuleBodyFunctionArgs;
}

type FunctionModuleExecutionCallback = (
  args: FunctionModuleExecutionCallbackArgs,
) => void;

const createFunctionModuleController = <ModuleBody>() => {
  const registeredExecutions = new Map<
    string,
    PromiseActions<FunctionModuleBodyResult<ModuleBody>>
  >();

  const create =
    (callback: FunctionModuleExecutionCallback) =>
    (...args: FunctionModuleBodyArgs<ModuleBody>) =>
      new Promise<FunctionModuleBodyResult<ModuleBody>>((resolve, reject) => {
        const id = v4();
        registeredExecutions.set(id, {
          reject,
          resolve,
        });
        callback({ args, id });
      });

  const get = (id: string) => {
    const execution = registeredExecutions.get(id);
    if (!execution) {
      throw new Error('No such execution');
    }
    return execution;
  };

  const reject = (id: string, error: Error) => {
    get(id).reject(error);
    registeredExecutions.delete(id);
  };

  return {
    create,
    get,
    reject,
  };
};

export default createFunctionModuleController;
