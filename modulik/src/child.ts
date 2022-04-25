import isPlainObject from 'lodash.isplainobject';
import { parentController } from './bridge';
import { callbackKeyName, exportedFunctionKeyName } from './constants';
import createFunctionController from './functionModuleController';
import {
  doesModuleExportAnyFunction,
  executeModuleFunction,
  isDataSerializable,
  parseModuleFunctionExecutionResult,
} from './utils';

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

const detectFunctionModuleAndSubstituteIt = (entity: any) => {
  if (!(entity instanceof Function)) return entity;
  return `[[${exportedFunctionKeyName}]]`;
};

const moduleBody = require(modulePath);

let parsedModuleBody = moduleBody;
if (isPlainObject(moduleBody)) {
  parsedModuleBody =
    'default' in parsedModuleBody
      ? detectFunctionModuleAndSubstituteIt(parsedModuleBody.default)
      : Object.entries(parsedModuleBody).reduce(
          (acc, [exportName, exportedEntity]) => {
            acc[exportName] =
              detectFunctionModuleAndSubstituteIt(exportedEntity);
            return acc;
          },
          parsedModuleBody,
        );
} else {
  parsedModuleBody = detectFunctionModuleAndSubstituteIt(parsedModuleBody);
}

type GenericCallback = (...args: any[]) => any;
const functionController = createFunctionController<GenericCallback>();

const callbackKeyRegex = new RegExp(
  `^${callbackKeyName}:([0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12})$`,
  'i',
);

const substituteCallbackRepresentationWithRealOne = (arg: any) => {
  if (typeof arg !== 'string') return arg;
  const callbackId = arg.match(callbackKeyRegex)?.[1];
  if (!callbackId) return arg;

  return functionController.create(callbackId, ({ args, executionId }) => {
    process.send!(
      parentController.executeCallback({
        args,
        callbackId,
        executionId,
      }),
    );
  });
};

if (doesModuleExportAnyFunction(parsedModuleBody)) {
  process.on(
    'message',
    parentController.makeMessageHandler({
      async callbackExecutionResult({ executionId, result }) {
        const { data, error } = parseModuleFunctionExecutionResult(
          result,
          'Execution result of a callback argument of your module is not serializable',
        );

        if (error) {
          functionController.rejectExecution(executionId, error);
          return;
        }
        functionController.resolveExecution(executionId, data);
      },
      async execute({ executionId, args: rawArgs }) {
        const args = rawArgs.map(arg => {
          if (Array.isArray(arg)) {
            return arg.map(substituteCallbackRepresentationWithRealOne);
          }

          if (typeof arg === 'object') {
            return Object.entries(arg).reduce((acc, [key, value]) => {
              acc[key] = substituteCallbackRepresentationWithRealOne(value);
              return acc;
            }, arg);
          }

          return substituteCallbackRepresentationWithRealOne(arg);
        });

        const result = await executeModuleFunction(
          () => moduleBody(...args),
          'Failed to execute the function exported by a given module',
        );
        process.send!(
          parentController.executionResult({ executionId, result }),
        );
      },
    }),
  );
}

const serializable = isDataSerializable(parsedModuleBody);
process.send!(
  parentController.ready({
    body: serializable ? parsedModuleBody : undefined,
    serializable,
  }),
);
