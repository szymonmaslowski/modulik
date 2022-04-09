import launchFully from './launchFully';
import launchPhantomly from './launchPhantomly';
import { Args } from './types';

const launch = <ModuleBody>({
  cfg,
  recreateModulePromise,
  rejectModule,
  resolveModule,
}: Args<ModuleBody>) =>
  (cfg.disabled ? launchPhantomly : launchFully)<ModuleBody>({
    cfg,
    recreateModulePromise,
    resolveModule,
    rejectModule,
  });

export default launch;
