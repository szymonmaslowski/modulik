import isPlainObject from 'lodash.isplainobject';
import v8 from 'v8';
import assert from 'assert';
import { exportedFunctionKeyName } from './constants';

const exportedFunctionKeyRegex = new RegExp(
  `^\\[\\[${exportedFunctionKeyName}]]$`,
  'i',
);

export const isEntityAFunctionRepresentation = (entity: any) =>
  typeof entity === 'string' && Boolean(entity.match(exportedFunctionKeyRegex));

export const doesModuleHaveAnyNamedExportedFunction = (moduleBody: any) =>
  isPlainObject(moduleBody) &&
  Object.values(moduleBody).some(isEntityAFunctionRepresentation);

export const doesModuleExportAnyFunction = (moduleBody: any) => {
  const functionUnderDefaultExport =
    isEntityAFunctionRepresentation(moduleBody);

  return (
    functionUnderDefaultExport ||
    doesModuleHaveAnyNamedExportedFunction(moduleBody)
  );
};

export const getNamedExportedFunctionsFromModule = (moduleBody: any) => {
  if (!doesModuleHaveAnyNamedExportedFunction(moduleBody)) {
    throw new Error('Module does not export any function');
  }
  return Object.entries(moduleBody)
    .filter(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ([_, entity]) => isEntityAFunctionRepresentation(entity),
    )
    .map(([name, body]) => ({ body, name }));
};

export const parseFunctionRepresentation = (
  functionRepresentation: string,
): string => {
  const functionId = functionRepresentation.match(
    exportedFunctionKeyRegex,
  )?.[1];
  if (!functionId) {
    throw new Error('Unable to parse function representation');
  }
  return functionId;
};

export const isDataSerializable = (data: any) => {
  try {
    const dataClone = v8.deserialize(v8.serialize(data));
    assert.deepStrictEqual(dataClone, data);
    return true;
  } catch (e) {
    return false;
  }
};

export const executeModuleFunction = async (
  func: Function,
  fallbackErrorMessage: string,
) => {
  try {
    const data = await func();
    const serializable = isDataSerializable(data);
    return {
      data: serializable ? data : undefined,
      error: false,
      serializable,
    };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : fallbackErrorMessage;
    return { data: errorMessage, error: true, serializable: false };
  }
};

interface ExecutionResult {
  data: any;
  error: boolean;
  serializable: boolean;
}

export const parseModuleFunctionExecutionResult = (
  result: ExecutionResult,
  serializationError: string,
) => {
  const data = result.error ? undefined : result.data;
  let error = result.error ? new Error(result.data) : undefined;
  if (!result.serializable) {
    error = new Error(serializationError);
  }
  return { data, error };
};
