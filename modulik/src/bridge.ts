import { v4 } from 'uuid';
import { GenericModuleBodyFunctionArgs, ModuleType } from './types';

interface Message<Type extends string, Data extends object> {
  data: Data;
  type: Type;
}

enum FromParentMessageType {
  execute = 'execute',
  callbackExecutionResult = 'callbackExecutionResult',
}

enum FromChildMessageType {
  executeCallback = 'executeCallback',
  executionResult = 'executionResult',
  ready = 'ready',
}

interface FromParentMessageExecuteData {
  args: GenericModuleBodyFunctionArgs;
  executionId: string;
}

type FromParentMessageExecute = Message<
  FromParentMessageType.execute,
  FromParentMessageExecuteData
>;

interface FromParentMessageCallbackExecutionResultDataResult {
  error: boolean;
  data: any;
}

interface FromParentMessageCallbackExecutionResultData {
  executionId: string;
  result: FromParentMessageCallbackExecutionResultDataResult;
}

type FromParentMessageCallbackExecutionResult = Message<
  FromParentMessageType.callbackExecutionResult,
  FromParentMessageCallbackExecutionResultData
>;

interface FromChildMessageReadyData {
  body: any;
  serializable: boolean;
  type: ModuleType;
}

type FromChildMessageReady = Message<
  FromChildMessageType.ready,
  FromChildMessageReadyData
>;

interface FromChildMessageExecutionResultDataResult {
  error: boolean;
  data: any;
}

interface FromChildMessageExecutionResultData {
  executionId: string;
  result: FromChildMessageExecutionResultDataResult;
}

type FromChildMessageExecutionResult = Message<
  FromChildMessageType.executionResult,
  FromChildMessageExecutionResultData
>;

interface FromChildMessageExecuteCallbackData {
  callbackId: string;
  executionId: string;
  args: any[];
}

type FromChildMessageExecuteCallback = Message<
  FromChildMessageType.executeCallback,
  FromChildMessageExecuteCallbackData
>;

interface MessageHandler<Args extends object> {
  (args: Args): void;
}

interface FromParentMessageHandlers {
  [FromParentMessageType.callbackExecutionResult]: MessageHandler<FromParentMessageCallbackExecutionResultData>;
  [FromParentMessageType.execute]: MessageHandler<FromParentMessageExecuteData>;
}

interface FromChildMessageHandlers {
  [FromChildMessageType.executeCallback]: MessageHandler<FromChildMessageExecuteCallbackData>;
  [FromChildMessageType.executionResult]: MessageHandler<FromChildMessageExecutionResultData>;
  [FromChildMessageType.ready]: MessageHandler<FromChildMessageReadyData>;
}

type BufferExecutionCallback = (error: Error | undefined, data: any) => void;

type ReleaseBufferedExecutionsGetExecutionArg = (
  executionData: FromParentMessageExecuteData,
) => void;

const createChildController = () => {
  const bufferOfExecutions = new Set<FromParentMessageExecuteData>();
  const childModuleExecutionCallbacks = new Map<
    string,
    BufferExecutionCallback
  >();

  const bufferExecution = (
    args: GenericModuleBodyFunctionArgs,
    callback: BufferExecutionCallback,
  ) => {
    const executionId = v4();
    childModuleExecutionCallbacks.set(executionId, callback);
    bufferOfExecutions.add({
      executionId,
      args,
    });
  };

  const releaseBufferedExecutions = (
    getExecution: ReleaseBufferedExecutionsGetExecutionArg,
  ) => {
    bufferOfExecutions.forEach(executionData => {
      getExecution(executionData);
    });
    bufferOfExecutions.clear();
  };

  const areThereExecutionsBuffered = () => Boolean(bufferOfExecutions.size);

  const resolveExecution = ({
    executionId,
    result,
  }: FromChildMessageExecutionResultData) => {
    const data = result.error ? undefined : result.data;
    const error = result.error ? new Error(result.data) : undefined;
    const callback = childModuleExecutionCallbacks.get(executionId);
    if (!callback) {
      throw new Error('Execution callback not found');
    }
    callback(error, data);
    childModuleExecutionCallbacks.delete(executionId);
  };

  const resolveAllExecutions = (
    result: FromChildMessageExecutionResultDataResult,
  ) => {
    bufferOfExecutions.forEach(({ executionId }) => {
      resolveExecution({ executionId, result });
    });
    bufferOfExecutions.clear();
  };

  return {
    bufferExecution,
    releaseBufferedExecutions,
    areThereExecutionsBuffered,
    resolveExecution,
    resolveAllExecutions,
    execute: (
      data: FromParentMessageExecuteData,
    ): FromParentMessageExecute => ({
      type: FromParentMessageType.execute,
      data,
    }),
    callbackExecutionResult: (
      data: FromParentMessageCallbackExecutionResultData,
    ): FromParentMessageCallbackExecutionResult => ({
      type: FromParentMessageType.callbackExecutionResult,
      data,
    }),
    makeMessageHandler:
      (handlers: FromChildMessageHandlers) =>
      ({
        type,
        data,
      }:
        | FromChildMessageExecuteCallback
        | FromChildMessageExecutionResult
        | FromChildMessageReady) =>
        // @ts-ignore
        handlers[type](data),
  };
};

const parentController = {
  ready: (data: FromChildMessageReadyData): FromChildMessageReady => ({
    type: FromChildMessageType.ready,
    data,
  }),
  executionResult: (
    data: FromChildMessageExecutionResultData,
  ): FromChildMessageExecutionResult => ({
    type: FromChildMessageType.executionResult,
    data,
  }),
  executeCallback: (
    data: FromChildMessageExecuteCallbackData,
  ): FromChildMessageExecuteCallback => ({
    type: FromChildMessageType.executeCallback,
    data,
  }),
  makeMessageHandler:
    (handlers: FromParentMessageHandlers) =>
    ({
      type,
      data,
    }: FromParentMessageCallbackExecutionResult | FromParentMessageExecute) =>
      // @ts-ignore
      handlers[type](data),
};

export { createChildController, parentController };
