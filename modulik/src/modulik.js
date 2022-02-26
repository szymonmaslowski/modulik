const EventEmitter = require('events');
const path = require('path');
const getCallerDirectoryPath = require('./getCallerDirectoryPath');
const launch = require('./launch');

const isItFirstSuchItem = (item, index, self) => self.indexOf(item) === index;
const systemSupportedExtensions = Object.keys(require.extensions).map(e =>
  e.replace('.', ''),
);

module.exports = (pathOrOptions, options) => {
  const providedConfig = Object.assign(
    {},
    typeof pathOrOptions === 'object' ? pathOrOptions : { path: pathOrOptions },
    typeof options === 'object' ? options : {},
  );
  if (!providedConfig.path) {
    throw new Error('Invalid module path');
  }

  const callerPath = getCallerDirectoryPath();
  const cfg = {
    path: path.resolve(callerPath, providedConfig.path),
    quiet: Boolean(providedConfig.quiet),
    disabled: Boolean(providedConfig.disabled),
  };
  cfg.extensions = systemSupportedExtensions
    .concat(
      Array.isArray(providedConfig.extensions) ? providedConfig.extensions : [],
    )
    .filter(isItFirstSuchItem);
  cfg.watch = (Array.isArray(providedConfig.watch) ? providedConfig.watch : [])
    .concat(providedConfig.path)
    .filter(isItFirstSuchItem)
    .reduce((acc, filePath) => {
      const absolutePath = path.resolve(callerPath, filePath);
      return acc.concat([
        absolutePath,
        `${absolutePath}.{${cfg.extensions.join(',')}}`,
      ]);
    }, []);
  cfg.transpiler = ['ts', 'babel'].includes(providedConfig.transpiler)
    ? { type: providedConfig.transpiler, options: {} }
    : false;
  if (cfg.transpiler && typeof providedConfig.transpilerOptions === 'object') {
    cfg.transpiler.options = providedConfig.transpilerOptions;
  }

  let moduleBodyPromise = null;
  let resolveModuleBodyPromise = () => {};
  let rejectModuleBodyPromise = () => {};
  const emitter = new EventEmitter();

  const recreateModuleBodyPromise = () => {
    moduleBodyPromise = new Promise((resolve, reject) => {
      resolveModuleBodyPromise = resolve;
      rejectModuleBodyPromise = reject;
    });
    // Prevent node from complaining about unhandled rejection
    moduleBodyPromise.catch(() => {});

    emitter.emit('restart');
  };
  const resolveModule = moduleBody => {
    resolveModuleBodyPromise(moduleBody);
    emitter.emit('ready');
  };
  const rejectModule = error => {
    rejectModuleBodyPromise(error);
    emitter.emit('failed', error);
  };

  recreateModuleBodyPromise();
  const moduleWrapper = launch({
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
