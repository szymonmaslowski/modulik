const path = require('path');
const getCallerFile = require('get-caller-file');
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

  const callerPath = path.dirname(getCallerFile());
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
    .reduce(
      (acc, filePathOrGlob) =>
        acc.concat([
          filePathOrGlob,
          `${filePathOrGlob}.{${cfg.extensions.join(',')}}`,
        ]),
      [],
    );

  let moduleBodyPromise = null;
  let resolveModuleBodyPromise = () => {};
  let rejectModuleBodyPromise = () => {};

  const recreateModuleBodyPromise = () => {
    moduleBodyPromise = new Promise((resolve, reject) => {
      resolveModuleBodyPromise = resolve;
      rejectModuleBodyPromise = reject;
    });
    // Prevent node from complaining about unhandled rejection
    moduleBodyPromise.catch(() => {});
  };

  const onRestart = () => {
    recreateModuleBodyPromise();
  };
  const onReady = moduleBody => {
    resolveModuleBodyPromise(moduleBody);
  };
  const onError = error => {
    rejectModuleBodyPromise(error);
  };

  recreateModuleBodyPromise();
  const { restart, kill } = launch({
    cfg,
    onRestart,
    onReady,
    onError,
  });

  return {
    get module() {
      return moduleBodyPromise;
    },
    restart: async () => restart(),
    kill: async () => kill(),
  };
};
