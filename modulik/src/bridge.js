const { v4 } = require('uuid');

const typeReady = 'ready';
const typeInvoke = 'invoke';
const typeInvocationResult = 'invocation-result';

const pick = (properties, source) =>
  properties.reduce((acc, name) => ({ ...acc, [name]: source[name] }), {});

const makeMessageHandlerMaker = definition => handlers => message => {
  const [handlerName, properties] = definition[message.type];
  const handler = handlers[handlerName] || (() => {});
  const data = pick(properties, message);
  handler(data);
};

const createChildController = () => {
  const bufferOfMessagesToModule = new Set();
  const childModuleInvocationsCallbacks = new Map();

  const bufferInvocation = (args, callback) => {
    const correlationId = v4();
    childModuleInvocationsCallbacks.set(correlationId, callback);
    bufferOfMessagesToModule.add({
      type: typeInvoke,
      correlationId,
      args,
    });
  };
  const releaseBufferedInvocations = sendMessage => {
    bufferOfMessagesToModule.forEach(message => {
      sendMessage(message);
    });
    bufferOfMessagesToModule.clear();
  };
  const areThereInvocationsBuffered = () => {
    return Boolean(bufferOfMessagesToModule.size);
  };
  const resolveInvocation = ({ correlationId, result }) => {
    const data = result.error ? undefined : result.data;
    const error = result.error ? new Error(result.data) : undefined;
    childModuleInvocationsCallbacks.get(correlationId)(error, data);
    childModuleInvocationsCallbacks.delete(correlationId);
  };
  const resolveAllInvocations = result => {
    bufferOfMessagesToModule.forEach(({ correlationId }) => {
      resolveInvocation({ correlationId, result });
    });
    bufferOfMessagesToModule.clear();
  };
  const makeMessageHandler = makeMessageHandlerMaker({
    [typeInvocationResult]: ['onInvocationResult', ['correlationId', 'result']],
    [typeReady]: ['onModuleReady', ['data']],
  });

  return {
    bufferInvocation,
    releaseBufferedInvocations,
    areThereInvocationsBuffered,
    resolveInvocation,
    resolveAllInvocations,
    makeMessageHandler,
  };
};

const parentController = {
  ready: ({ type, body }) => ({
    type: typeReady,
    data: {
      type,
      body,
    },
  }),
  invocationResult: ({ correlationId, result }) => ({
    type: typeInvocationResult,
    correlationId,
    result,
  }),
  makeMessageHandler: makeMessageHandlerMaker({
    [typeInvoke]: ['onInvoke', ['correlationId', 'args']],
  }),
};

module.exports = {
  createChildController,
  parentController,
};
