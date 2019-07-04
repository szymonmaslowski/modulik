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

process.on('message', async ({ type, correlationId, data }) => {
  if (type === 'call') {
    if (moduleType !== 'function') return;
    const result = await childModule(data);
    process.send({ type: 'call-result', correlationId, result });
  }
});
process.send({
  type: 'ready',
  moduleType,
  moduleBody: serializable ? childModule : undefined,
});
