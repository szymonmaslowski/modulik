import { v4 } from 'uuid';
import {
  GenericModuleBodyFunctionArgs,
  FunctionModuleBodyArgs,
  FunctionModuleBodyResult,
  PromiseActions,
} from './types';

interface FunctionModuleExecutionCallbackArgs {
  args: GenericModuleBodyFunctionArgs;
  executionId: string;
  functionId: string;
}

export type FunctionModuleExecutionCallback = (
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
    (functionId: string, callback: FunctionModuleExecutionCallback) =>
    (...rawArgs: FunctionModuleBodyArgs<ModuleBody>) =>
      new Promise<FunctionModuleBodyResult<ModuleBody>>((resolve, reject) => {
        const args = parseArguments(rawArgs);

        const executionId = v4();
        registeredExecutions.set(executionId, {
          reject,
          resolve,
        });
        callback({ args, executionId, functionId });
      });

  const getExecution = (id: string) => {
    const execution = registeredExecutions.get(id);
    if (!execution) {
      throw new Error('No such execution');
    }
    return execution;
  };

  const rejectExecution = (id: string, error: Error) => {
    getExecution(id).reject(error);
    registeredExecutions.delete(id);
  };

  const resolveExecution = (id: string, value: any) => {
    getExecution(id).resolve(value);
    registeredExecutions.delete(id);
  };

  return {
    create,
    rejectExecution,
    resolveExecution,
  };
};

export default createFunctionController;
