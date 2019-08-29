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

process.on('message', async ({ type, correlationId, args }) => {
  if (type === 'invoke') {
    if (moduleType !== 'function') return;
    let result = null;
    try {
      const data = await childModule(...args);
      result = { data };
    } catch (e) {
      result = { data: e.message, error: true };
    }
    process.send({ type: 'invocation-result', correlationId, result });
  }
});
process.send({
  type: 'ready',
  data: {
    type: moduleType,
    body: serializable ? childModule : undefined,
  },
});
