import path from 'path';
import createLogger from './logger';
import { Args, LaunchApi } from './types';

interface ModuleWithDefaultExport {
  default: any;
}

type Module = any | ModuleWithDefaultExport;

const launchPhantomly = <ModuleBody>({
  cfg,
  resolveModule,
  rejectModule,
}: Args<ModuleBody>): LaunchApi => {
  const moduleFileName = path.parse(cfg.path).base;
  const logger = createLogger(moduleFileName, cfg.quiet);
  process.nextTick(() => {
    let importedModule: Module;
    try {
      importedModule = require(cfg.path);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.stack : JSON.stringify(e);
      process.stderr.write(`${errorMessage}\n`);
      logger.error('Exited unexpectedly');
      rejectModule(new Error('Module exited unexpectedly'));
      return;
    }

    const moduleBody: ModuleBody = importedModule.default || importedModule;
    resolveModule(moduleBody);
    logger.info('Ready.');
  });

  return {
    restart: () => {},
    kill: () => {},
  };
};

export default launchPhantomly;
