import { parentController } from './bridge';
import { callbackKeyName } from './constants';
import createFunctionController from './functionModuleController';

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

type GenericCallback = (...args: any[]) => any;
const callbackController = createFunctionController<GenericCallback>();

const callbackKeyRegex = new RegExp(
  `^${callbackKeyName}:([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})$`,
  'i',
);

const substituteCallbackRepresentationWithRealOne = (arg: any) => {
  const callbackId = arg.match(callbackKeyRegex)?.[1];
  if (!callbackId) return arg;

  return callbackController.create(({ id: executionId, args }) => {
    process.send!(
      parentController.executeCallback({
        args,
        callbackId,
        executionId,
      }),
    );
  });
};

if (moduleType === 'function') {
  process.on(
    'message',
    parentController.makeMessageHandler({
      async callbackExecutionResult({ executionId, result }) {
        const data = result.error ? undefined : result.data;
        const error = result.error ? new Error(result.data) : undefined;

        const execution = callbackController.get(executionId);
        if (error) {
          execution.reject(error);
          return;
        }
        execution.resolve(data);
      },
      async execute({ executionId, args: rawArgs }) {
        const args = rawArgs.map(arg => {
          if (Array.isArray(arg)) {
            return arg.map(substituteCallbackRepresentationWithRealOne);
          }

          if (typeof arg === 'object') {
            return Object.entries(arg).reduce(
              (acc, [key, value]) =>
                Object.assign(acc, {
                  [key]: substituteCallbackRepresentationWithRealOne(value),
                }),
              arg,
            );
          }

          return substituteCallbackRepresentationWithRealOne(arg);
        });

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
          parentController.executionResult({ executionId, result }),
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
