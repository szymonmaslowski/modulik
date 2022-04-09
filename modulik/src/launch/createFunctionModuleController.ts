import { v4 } from 'uuid';
import { ModuleBodyFunctionArgs, PromiseActions } from '../types';

interface FunctionModuleExecutionCallbackArgs {
  id: string;
  args: ModuleBodyFunctionArgs;
}

type FunctionModuleExecutionCallback = (
  args: FunctionModuleExecutionCallbackArgs,
) => void;

type FunctionModule<Result extends any = any> = (...args: any[]) => Result;

type ModuleBodyArgs<ModuleBody> = ModuleBody extends FunctionModule
  ? Parameters<ModuleBody>
  : never;

type ModuleBodyResult<ModuleBody> = ModuleBody extends FunctionModule<
  Promise<any>
>
  ? Awaited<ReturnType<ModuleBody>>
  : ModuleBody extends FunctionModule
  ? ReturnType<ModuleBody>
  : never;

const createFunctionModuleController = <ModuleBody>() => {
  const registeredExecutions = new Map<
    string,
    PromiseActions<ModuleBodyResult<ModuleBody>>
  >();

  const create = (callback: FunctionModuleExecutionCallback) => (
    ...args: ModuleBodyArgs<ModuleBody>
  ) =>
    new Promise<ModuleBodyResult<ModuleBody>>((resolve, reject) => {
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
