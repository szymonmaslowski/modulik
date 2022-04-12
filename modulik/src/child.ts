import { parentController } from './bridge';

process.on('SIGTERM', () => {
  process.exit(0);
});

const [modulePath, rawTranspiler] = process.argv.slice(2);
const transpiler = JSON.parse(rawTranspiler);

// eslint-disable-next-line consistent-return
const importTranspilerOrExit = (packageName: string) => {
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
  if (type === 'typescript') {
    importTranspilerOrExit('ts-node').register(options);
  }
}

let childModule = require(modulePath);
const moduleHavingDefaultExport =
  childModule && typeof childModule === 'object' && 'default' in childModule;
if (moduleHavingDefaultExport) {
  childModule = childModule.default;
}

const moduleType = typeof childModule;
let serializable;
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
      async execute({ correlationId, args }) {
        let result = null;
        try {
          const data = await childModule(...args);
          result = { data, error: false };
        } catch (e) {
          const errorMessage =
            e instanceof Error
              ? e.message
              : 'Failed to execute the function exported by a given module';
          result = { data: errorMessage, error: true };
        }
        process.send!(
          parentController.executionResult({ correlationId, result }),
        );
      },
    }),
  );
}

process.send!(
  parentController.ready({
    body: serializable ? childModule : undefined,
    serializable,
    type: moduleType,
  }),
);
