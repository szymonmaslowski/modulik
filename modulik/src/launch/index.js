const launchFully = require('./launchFully');
const launchPhantomly = require('./launchPhantomly');

const launch = ({ cfg, recreateModulePromise, resolveModule, rejectModule }) =>
  (cfg.disabled ? launchPhantomly : launchFully)({
    cfg,
    recreateModulePromise,
    resolveModule,
    rejectModule,
  });

module.exports = launch;
