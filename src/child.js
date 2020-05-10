const { parentController } = require('./bridge');

const modulePath = process.argv[2];
const childModule = require(modulePath);

const moduleType = typeof childModule;
let serializable = false;
try {
  const serialized = JSON.stringify(childModule);
  serializable = Boolean(serialized);
} catch (e) {
  serializable = false;
}

process.on(
  'message',
  parentController.makeMessageHandler({
    async onInvoke({ correlationId, args }) {
      if (moduleType !== 'function') return;
      let result = null;
      try {
        const data = await childModule(...args);
        result = { data };
      } catch (e) {
        result = { data: e.message, error: true };
      }
      process.send(
        parentController.invocationResult({ correlationId, result }),
      );
    },
  }),
);

process.send(
  parentController.ready({
    type: moduleType,
    body: serializable ? childModule : undefined,
  }),
);
