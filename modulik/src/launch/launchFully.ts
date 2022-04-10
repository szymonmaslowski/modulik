import { ChildProcess, fork } from 'child_process';
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { createChildController } from '../bridge';
import createState from '../state';
import { PromiseReject, PromiseResolve, TranspilerType } from '../types';
import createFunctionModuleController from './createFunctionModuleController';
import createLogger from './logger';
import { Args, LaunchApi } from './types';

const childPath = path.resolve(__dirname, '../child.js');

const mapOfTranspilerToModuleName: { [key in TranspilerType]: string } = {
  [TranspilerType.babel]: '@babel/register',
  [TranspilerType.typescript]: 'ts-node',
};

const launchFully = <ModuleBody>({
  cfg,
  recreateModulePromise,
  resolveModule,
  rejectModule,
}: Args<ModuleBody>): LaunchApi => {
  const moduleFileName = path.parse(cfg.path).base;
  const logger = createLogger(moduleFileName, cfg.quiet);
  const childController = createChildController();
  const functionModule = createFunctionModuleController<ModuleBody>();

  let fsWatcher: FSWatcher | null = null;
  let childProcess: ChildProcess | null = null;

  const restartRequestResolversQueue = new Set<PromiseResolve>();
  const restartRequestRejectersQueue = new Set<PromiseReject>();
  const getRestartRequestPromise = () =>
    new Promise((resolve, reject) => {
      restartRequestResolversQueue.add(resolve);
      restartRequestRejectersQueue.add(reject);
    });
  const resolveRestartRequestPromises = () => {
    restartRequestResolversQueue.forEach(resolve => resolve(undefined));
    restartRequestResolversQueue.clear();
  };
  const rejectRestartRequestPromises = (error: Error) => {
    restartRequestRejectersQueue.forEach(reject => reject(error));
    restartRequestRejectersQueue.clear();
  };

  let resolveKillRequestPromise: PromiseResolve = () => {};
  const killRequestPromise = new Promise(resolve => {
    resolveKillRequestPromise = resolve;
  });

  const noChildProcessError = new Error('Child process not created');

  const state = createState({
    logReady: () => logger.info('Ready.'),
    logRestarting: () => logger.info('Restarting..'),
    logFailed: () => logger.error('Exited unexpectedly'),
    logTranspilerError: () => {
      if (!cfg.transpiler) {
        throw new Error('Transpiler not configured');
      }

      logger.error(
        `"${cfg.transpiler.type}" transpiler is enabled but the "${
          mapOfTranspilerToModuleName[cfg.transpiler.type]
        }" module could not be found. Did you forget to install it?`,
      );
    },
    logCannotRestartKilledModule: () =>
      logger.error('Module killed - cannot restart'),
    recreateModulePromise,
    resolveModule: ({ data: { body, type } }) => {
      if (type !== 'function') {
        resolveModule(body);
        return;
      }

      const functionModuleWrapper = functionModule.create(({ args, id }) => {
        state.execute({ args, executionId: id });
      });

      // @ts-ignore FIXME: TS doesn't understand that runtime `type` variable identifies the module body as a function
      resolveModule(functionModuleWrapper);
    },
    areThereExecutionsBuffered: () =>
      childController.areThereExecutionsBuffered(),
    bufferExecution: ({ args, executionId }) => {
      const execution = functionModule.get(executionId);
      childController.bufferExecution(args, (error, data) => {
        if (error) {
          execution.reject(error);
          return;
        }
        execution.resolve(data);
      });
    },
    releaseBufferedExecutions: () => {
      childController.releaseBufferedExecutions(message => {
        if (!childProcess) {
          throw noChildProcessError;
        }
        childProcess.send(message);
      });
    },
    rejectModuleWithAvailabilityError: () => {
      rejectModule(new Error('Module unavailable'));
    },
    rejectModuleWithFailureError: () => {
      rejectModule(new Error('Module exited unexpectedly'));
    },
    rejectModuleWithSerializationError: () => {
      rejectModule(
        new Error('Value exported from your module is not serializable'),
      );
    },
    rejectModuleWithTranspilerError: () => {
      rejectModule(new Error('Transpiler module not found'));
    },
    rejectExecutionWithKilledModuleError: ({ executionId }) => {
      functionModule.reject(
        executionId,
        new Error('Cannot execute killed module'),
      );
    },
    rejectExecutionWithInvalidModuleTypeError: ({ executionId, type }) => {
      functionModule.reject(
        executionId,
        new Error(`Cannot execute module of ${type} type`),
      );
    },
    startFSWatcher: () => {
      fsWatcher = chokidar
        .watch(cfg.watch, { ignoreInitial: true })
        .on('all', () => {
          state.moduleChanged();
        })
        .on('ready', () => {
          state.fSWatcherReady();
        });
    },
    startChildProcess: () => {
      childProcess = fork(childPath, [
        cfg.path,
        JSON.stringify(cfg.transpiler),
      ]);
      childProcess.on(
        'message',
        childController.makeMessageHandler({
          executionResult({ correlationId, result }) {
            childController.resolveExecution({ correlationId, result });
          },
          ready: ({ body, serializable, type }) => {
            state.ready({ body, serializable, type });
          },
        }),
      );
      childProcess.on('exit', code => {
        state.processExited({
          clean: [0, null].includes(code),
          transpilerError: code === 2,
        });
      });
    },
    terminateBufferedExecutions: () => {
      childController.resolveAllExecutions({
        error: true,
        data: 'Module is not a function. Cannot execute.',
      });
    },
    logBufferedExecutionsTerminated: () => {
      logger.error(
        'There were executions buffered, but the module is not a function anymore. Buffered executions has been forgotten.',
      );
    },
    stopChildProcess: () => {
      if (!childProcess) {
        throw noChildProcessError;
      }
      childProcess.kill();
    },
    stopFSWatcher: async () => {
      if (!fsWatcher) {
        throw new Error('File system watcher not created');
      }
      await fsWatcher.close();
      state.fSWatcherStopped();
    },
    notifyRestarted: () => resolveRestartRequestPromises(),
    notifyRestartFailed: () =>
      rejectRestartRequestPromises(new Error('Module exited unexpectedly')),
    notifyKilled: () => resolveKillRequestPromise(undefined),
  });

  return {
    restart: () => {
      const promise = getRestartRequestPromise();
      state.restartRequested();
      return promise;
    },
    kill: () => {
      state.killRequested();
      return killRequestPromise;
    },
  };
};

export default launchFully;
