import { transpilerTypeBabel, transpilerTypeTypescript } from './constants';

export type TranspilerType =
  | typeof transpilerTypeBabel
  | typeof transpilerTypeTypescript;

type TranspilerOptions = object;

interface InputOptionsCommon {
  disabled?: boolean;
  transpiler?: TranspilerType;
  transpilerOptions?: TranspilerOptions;
  watch?: string[];
  watchExtensions?: string[];
  quiet?: boolean;
}

export interface InputOptionsFirstArg extends InputOptionsCommon {
  path: string;
}

export interface InputOptionsSecondArg extends InputOptionsCommon {
  path?: string;
}

export interface TranspilerConfigEntry {
  type: TranspilerType;
  options: TranspilerOptions;
}

export interface Config {
  disabled: boolean;
  path: string;
  transpiler: TranspilerConfigEntry | false;
  watch: string[];
  quiet: boolean;
}

export type PromiseResolve<Value = undefined> = (value: Value) => void;

export type PromiseReject = (error: Error) => void;

export interface PromiseActions<Value> {
  reject: PromiseReject;
  resolve: PromiseResolve<Value>;
}

export type GenericModuleBodyFunctionArgs = any[];

type FunctionModule<Result extends any = any, Args extends any[] = any[]> = (
  ...args: Args
) => Result;

export type FunctionModuleBodyArgs<ModuleBody> =
  ModuleBody extends FunctionModule ? Parameters<ModuleBody> : never;

export type FunctionModuleBodyResult<ModuleBody> =
  ModuleBody extends FunctionModule<Promise<any>>
    ? Awaited<ReturnType<ModuleBody>>
    : ModuleBody extends FunctionModule
    ? ReturnType<ModuleBody>
    : never;

export type ModulikModuleBody<ModuleBody> = ModuleBody extends FunctionModule
  ? FunctionModule<
      Promise<FunctionModuleBodyResult<ModuleBody>>,
      FunctionModuleBodyArgs<ModuleBody>
    >
  : ModuleBody;

export type ExecutionId = string;

export type ModuleType =
  | 'string'
  | 'number'
  | 'bigint'
  | 'boolean'
  | 'symbol'
  | 'undefined'
  | 'object'
  | 'function';
