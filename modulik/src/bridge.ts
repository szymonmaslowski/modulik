import { v4 } from 'uuid';
import v8 from 'v8';
import { GenericModuleBodyFunctionArgs } from './types';
import { parseModuleFunctionExecutionResult } from './utils';

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
  functionId: string;
}

type FromParentMessageExecute = Message<
  FromParentMessageType.execute,
  FromParentMessageExecuteData
>;

interface FromParentMessageCallbackExecutionResultDataResult {
  data: any;
  error: boolean;
  serializable: boolean;
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
}

type FromChildMessageReady = Message<
  FromChildMessageType.ready,
  FromChildMessageReadyData
>;

interface FromChildMessageExecutionResultDataResult {
  data: any;
  error: boolean;
  serializable: boolean;
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

interface BufferExecutionArgs {
  args: GenericModuleBodyFunctionArgs;
  callback: BufferExecutionCallback;
  functionId: string;
}

interface MessageBuffer {
  type: 'buffer';
  data: number[];
}
const deserialized = (handler: Function) => (messageBuffer: MessageBuffer) =>
  handler(v8.deserialize(new Uint8Array(messageBuffer.data)));

const createChildController = () => {
  const mapOfExecutionsBuffers = new Map<
    string,
    Set<FromParentMessageExecuteData>
  >();
  const childModuleExecutionCallbacks = new Map<
    string,
    BufferExecutionCallback
  >();

  const bufferExecution = ({
    args,
    callback,
    functionId,
  }: BufferExecutionArgs) => {
    const executionId = v4();
    childModuleExecutionCallbacks.set(executionId, callback);
    mapOfExecutionsBuffers.set(
      functionId,
      (mapOfExecutionsBuffers.get(functionId) || new Set()).add({
        args,
        executionId,
        functionId,
      }),
    );
  };

  const releaseBufferedExecutions = (
    functionId: string,
    getExecution: ReleaseBufferedExecutionsGetExecutionArg,
  ) => {
    const bufferOfExecutions = mapOfExecutionsBuffers.get(functionId);
    if (!bufferOfExecutions) {
      throw new Error('There is no buffer of executions for given function id');
    }

    bufferOfExecutions.forEach(executionData => {
      getExecution(executionData);
    });
    mapOfExecutionsBuffers.clear();
  };

  const areThereExecutionsBuffered = () => Boolean(mapOfExecutionsBuffers.size);

  const resolveExecution = ({
    executionId,
    result,
  }: FromChildMessageExecutionResultData) => {
    const { data, error } = parseModuleFunctionExecutionResult(
      result,
      'Execution result of function exported from your module is not serializable',
    );

    const callback = childModuleExecutionCallbacks.get(executionId);
    if (!callback) {
      throw new Error('Execution callback not found');
    }

    callback(error, data);
    childModuleExecutionCallbacks.delete(executionId);
  };

  const resolveAllExecutions = (
    functionId: string,
    result: FromChildMessageExecutionResultDataResult,
  ) => {
    const bufferOfExecutions = mapOfExecutionsBuffers.get(functionId);
    if (!bufferOfExecutions) {
      throw new Error('There is no buffer of executions for given function id');
    }

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
    execute: (data: FromParentMessageExecuteData): Buffer =>
      v8.serialize({
        type: FromParentMessageType.execute,
        data,
      }),
    callbackExecutionResult: (
      data: FromParentMessageCallbackExecutionResultData,
    ): Buffer =>
      v8.serialize({
        type: FromParentMessageType.callbackExecutionResult,
        data,
      }),
    makeMessageHandler: (handlers: FromChildMessageHandlers) =>
      deserialized(
        ({
          type,
          data,
        }:
          | FromChildMessageExecuteCallback
          | FromChildMessageExecutionResult
          | FromChildMessageReady) =>
          // @ts-ignore
          handlers[type](data),
      ),
  };
};

const parentController = {
  ready: (data: FromChildMessageReadyData) =>
    v8.serialize({
      type: FromChildMessageType.ready,
      data,
    }),
  executionResult: (data: FromChildMessageExecutionResultData) =>
    v8.serialize({
      type: FromChildMessageType.executionResult,
      data,
    }),
  executeCallback: (data: FromChildMessageExecuteCallbackData) =>
    v8.serialize({
      type: FromChildMessageType.executeCallback,
      data,
    }),
  makeMessageHandler: (handlers: FromParentMessageHandlers) =>
    deserialized(
      ({
        type,
        data,
      }: FromParentMessageCallbackExecutionResult | FromParentMessageExecute) =>
        // @ts-ignore
        handlers[type](data),
    ),
};

export { createChildController, parentController };
