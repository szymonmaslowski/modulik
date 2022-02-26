const { parentController } = require('./bridge');

process.on('SIGTERM', () => {
  process.exit(0);
});

const [modulePath, rawTranspiler] = process.argv.slice(2);
const transpiler = JSON.parse(rawTranspiler);

// eslint-disable-next-line consistent-return
const importTranspilerOrExit = packageName => {
  try {
    return require(packageName);
  } catch (e) {
    process.exit(2);
  }
};

if (transpiler) {
  const { type, options = {} } = transpiler;
  if (type === 'babel') {
    importTranspilerOrExit('@babel/register')(options);
  }
  if (type === 'ts') {
    importTranspilerOrExit('ts-node').register(options);
  }
}

let childModule = require(modulePath);
if (transpiler && childModule.default) {
  childModule = childModule.default;
}

const moduleType = typeof childModule;
let serializable = false;
try {
  const serialized = JSON.stringify(childModule);
  serializable = Boolean(serialized);
} catch (e) {
  serializable = false;
}

if (moduleType === 'function') {
  process.on(
    'message',
    parentController.makeMessageHandler({
      async onInvoke({ correlationId, args }) {
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
}

process.send(
  parentController.ready({
    type: moduleType,
    body: serializable ? childModule : undefined,
  }),
);
