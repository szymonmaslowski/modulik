import EventEmitter from 'events';
import path from 'path';
import getCallerDirectoryPath from './getCallerDirectoryPath';
import launch from './launch';
import {
  Config,
  InputOptionsFirstArg,
  InputOptionsSecondArg,
  PromiseReject,
  PromiseResolve,
  TranspilerConfigEntry,
  TranspilerType,
} from './types';

const isItFirstSuchItem = (item: string, index: number, self: string[]) =>
  self.indexOf(item) === index;
const systemSupportedExtensions = Object.keys(require.extensions).map(e =>
  e.replace('.', ''),
);

enum ModulikEvents {
  restart = 'restart',
  ready = 'ready',
  failed = 'failed',
}

interface ModulikModule<ModuleBody> extends EventEmitter {
  readonly module: Promise<ModuleBody>;
  restart: () => Promise<void>;
  kill: () => Promise<void>;
  on(eventName: ModulikEvents.ready, listener: () => void): this;
  on(eventName: ModulikEvents.restart, listener: () => void): this;
  on(eventName: ModulikEvents.failed, listener: (error: Error) => void): this;
}

const modulik = <ModuleBody>(
  pathOrOptions: InputOptionsFirstArg | string,
  options?: InputOptionsSecondArg,
): ModulikModule<ModuleBody> => {
  const providedConfig = Object.assign(
    {},
    typeof pathOrOptions === 'object' ? pathOrOptions : { path: pathOrOptions },
    typeof options === 'object' ? options : {},
  );
  if (!providedConfig.path) {
    throw new Error('Invalid module path');
  }

  const callerPath = getCallerDirectoryPath();
  const watchExtensions = systemSupportedExtensions
    .concat(
      Array.isArray(providedConfig.watchExtensions)
        ? providedConfig.watchExtensions
        : [],
    )
    .filter(isItFirstSuchItem);

  const watchConfig = (
    Array.isArray(providedConfig.watch) ? providedConfig.watch : []
  )
    .concat(providedConfig.path)
    .filter(isItFirstSuchItem)
    .reduce((acc: string[], filePath) => {
      const absolutePath = path.resolve(callerPath, filePath);
      return acc.concat([
        absolutePath,
        `${absolutePath}.{${watchExtensions.join(',')}}`,
      ]);
    }, []);

  const transpilerOptions =
    typeof providedConfig.transpilerOptions === 'object'
      ? providedConfig.transpilerOptions
      : {};
  let transpilerConfig: TranspilerConfigEntry | false = false;
  if (
    providedConfig.transpiler &&
    Object.values(TranspilerType).includes(providedConfig.transpiler)
  ) {
    transpilerConfig = {
      type: providedConfig.transpiler,
      options: transpilerOptions,
    };
  }

  const cfg: Config = {
    disabled: Boolean(providedConfig.disabled),
    path: path.resolve(callerPath, providedConfig.path),
    transpiler: transpilerConfig,
    watch: watchConfig,
    quiet: Boolean(providedConfig.quiet),
  };

  let moduleBodyPromise: Promise<ModuleBody>;
  let resolveModuleBodyPromise: PromiseResolve<ModuleBody> = () => {};
  let rejectModuleBodyPromise: PromiseReject = () => {};
  const emitter = new EventEmitter();

  const recreateModuleBodyPromise = () => {
    moduleBodyPromise = new Promise((resolve, reject) => {
      resolveModuleBodyPromise = resolve;
      rejectModuleBodyPromise = reject;
    });
    // Prevent node from complaining about unhandled rejection
    moduleBodyPromise.catch(() => {});

    emitter.emit(ModulikEvents.restart);
  };
  const resolveModule = (moduleBody: ModuleBody) => {
    resolveModuleBodyPromise(moduleBody);
    emitter.emit(ModulikEvents.ready);
  };
  const rejectModule = (error: Error) => {
    rejectModuleBodyPromise(error);
    emitter.emit(ModulikEvents.failed, error);
  };

  recreateModuleBodyPromise();
  const moduleWrapper = launch<ModuleBody>({
    cfg,
    recreateModulePromise: recreateModuleBodyPromise,
    resolveModule,
    rejectModule,
  });

  const restart = async () => {
    await moduleWrapper.restart();
    await moduleBodyPromise.catch(() => {});
  };

  const kill = async () => {
    await moduleWrapper.kill();
    await moduleBodyPromise.catch(() => {});
  };

  return Object.setPrototypeOf(
    {
      get module() {
        return moduleBodyPromise;
      },
      restart,
      kill,
    },
    emitter,
  );
};

export default modulik;
