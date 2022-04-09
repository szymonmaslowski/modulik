export enum TranspilerType {
  babel = 'babel',
  typescript = 'typescript',
}

type TranspilerOptions = Object;

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

export interface PromiseReject {
  (error: Error): void;
}

export interface PromiseActions<Value> {
  reject: PromiseReject;
  resolve: PromiseResolve<Value>;
}

export type ModuleBodyFunctionArgs = any[];

export type ExecutionId = string;

export type ModuleType =
  | 'number'
  | 'string'
  | 'boolean'
  | 'undefined'
  | 'object'
  | 'function';
