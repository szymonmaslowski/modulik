import { v4 } from 'uuid';
import { GenericModuleBodyFunctionArgs, ModuleType } from './types';

interface Message<Type extends string, Data extends object> {
  data: Data;
  type: Type;
}

enum ParentMessageType {
  execute = 'execute',
}

enum ChildMessageType {
  ready = 'ready',
  executionResult = 'executionResult',
}

interface ParentMessageExecuteData {
  args: GenericModuleBodyFunctionArgs;
  correlationId: string;
}

type ParentMessageExecute = Message<
  ParentMessageType.execute,
  ParentMessageExecuteData
>;

interface ChildMessageReadyData {
  body: any;
  serializable: boolean;
  type: ModuleType;
}

type ChildMessageReady = Message<ChildMessageType.ready, ChildMessageReadyData>;

interface ChildMessageExecutionResultDataResult {
  error: boolean;
  data: any;
}

interface ChildMessageExecutionResultData {
  correlationId: string;
  result: ChildMessageExecutionResultDataResult;
}

type ChildMessageExecutionResult = Message<
  ChildMessageType.executionResult,
  ChildMessageExecutionResultData
>;

interface MessageHandler<Args extends object> {
  (args: Args): void;
}

interface ParentMessageHandlers {
  [ParentMessageType.execute]: MessageHandler<ParentMessageExecuteData>;
}

interface ChildMessageHandlers {
  [ChildMessageType.executionResult]: MessageHandler<ChildMessageExecutionResultData>;
  [ChildMessageType.ready]: MessageHandler<ChildMessageReadyData>;
}

type BufferExecutionCallback = (error: Error | undefined, data: any) => void;

type ReleaseBufferedExecutionsSendMessageArg = (
  message: ParentMessageExecute,
) => void;

const createChildController = () => {
  const bufferOfExecutionMessages = new Set<ParentMessageExecute>();
  const childModuleExecutionCallbacks = new Map<
    string,
    BufferExecutionCallback
  >();

  const bufferExecution = (
    args: GenericModuleBodyFunctionArgs,
    callback: BufferExecutionCallback,
  ) => {
    const correlationId = v4();
    childModuleExecutionCallbacks.set(correlationId, callback);
    bufferOfExecutionMessages.add({
      type: ParentMessageType.execute,
      data: {
        correlationId,
        args,
      },
    });
  };

  const releaseBufferedExecutions = (
    sendMessage: ReleaseBufferedExecutionsSendMessageArg,
  ) => {
    bufferOfExecutionMessages.forEach(message => {
      sendMessage(message);
    });
    bufferOfExecutionMessages.clear();
  };

  const areThereExecutionsBuffered = () =>
    Boolean(bufferOfExecutionMessages.size);

  const resolveExecution = ({
    correlationId,
    result,
  }: ChildMessageExecutionResultData) => {
    const data = result.error ? undefined : result.data;
    const error = result.error ? new Error(result.data) : undefined;
    const callback = childModuleExecutionCallbacks.get(correlationId);
    if (!callback) {
      throw new Error('Execution callback not found');
    }
    callback(error, data);
    childModuleExecutionCallbacks.delete(correlationId);
  };

  const resolveAllExecutions = (
    result: ChildMessageExecutionResultDataResult,
  ) => {
    bufferOfExecutionMessages.forEach(
      ({ data: { correlationId } }: ParentMessageExecute) => {
        resolveExecution({ correlationId, result });
      },
    );
    bufferOfExecutionMessages.clear();
  };

  return {
    bufferExecution,
    releaseBufferedExecutions,
    areThereExecutionsBuffered,
    resolveExecution,
    resolveAllExecutions,
    makeMessageHandler:
      (handlers: ChildMessageHandlers) =>
      ({ type, data }: ChildMessageReady | ChildMessageExecutionResult) =>
        // @ts-ignore
        handlers[type](data),
  };
};

const parentController = {
  ready: (data: ChildMessageReadyData): ChildMessageReady => ({
    type: ChildMessageType.ready,
    data,
  }),
  executionResult: (
    data: ChildMessageExecutionResultData,
  ): ChildMessageExecutionResult => ({
    type: ChildMessageType.executionResult,
    data,
  }),
  makeMessageHandler:
    (handlers: ParentMessageHandlers) =>
    ({ type, data }: ParentMessageExecute) =>
      handlers[type](data),
};

export { createChildController, parentController };
