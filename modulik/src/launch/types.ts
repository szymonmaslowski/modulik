import { Config, PromiseReject, PromiseResolve } from '../types';

type RecreateModulePromise = () => void;
type RejectModule = PromiseReject;
type ResolveModule<ModuleBody> = PromiseResolve<ModuleBody>;

export interface Args<ModuleBody> {
  cfg: Config;
  recreateModulePromise: RecreateModulePromise;
  rejectModule: RejectModule;
  resolveModule: ResolveModule<ModuleBody>;
}

export interface LaunchApi {
  kill: () => void;
  restart: () => void;
}
