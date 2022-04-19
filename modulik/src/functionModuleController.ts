import { v4 } from 'uuid';
import {
  GenericModuleBodyFunctionArgs,
  FunctionModuleBodyArgs,
  FunctionModuleBodyResult,
  PromiseActions,
} from './types';

interface FunctionModuleExecutionCallbackArgs {
  id: string;
  args: GenericModuleBodyFunctionArgs;
}

type FunctionModuleExecutionCallback = (
  args: FunctionModuleExecutionCallbackArgs,
) => void;

const createFunctionController = <ModuleBody>(
  parseArguments: (args: any[]) => any[] = a => a,
) => {
  const registeredExecutions = new Map<
    string,
    PromiseActions<FunctionModuleBodyResult<ModuleBody>>
  >();

  const create =
    (callback: FunctionModuleExecutionCallback) =>
    (...rawArgs: FunctionModuleBodyArgs<ModuleBody>) =>
      new Promise<FunctionModuleBodyResult<ModuleBody>>((resolve, reject) => {
        const args = parseArguments(rawArgs);

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

export default createFunctionController;
