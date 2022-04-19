import { ChildProcess, fork } from 'child_process';
import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import { createChildController } from '../bridge';
import createCallbacksController from '../callbacksController';
import {
  childPath,
  transpilerTypeBabel,
  transpilerTypeTypescript,
} from '../constants';
import createFunctionController from '../functionModuleController';
import createState from '../state';
import { PromiseReject, PromiseResolve, TranspilerType } from '../types';
import createLogger from './logger';
import { Args, LaunchApi } from './types';

const mapOfTranspilerToModuleName: { [key in TranspilerType]: string } = {
  [transpilerTypeBabel]: '@babel/register',
  [transpilerTypeTypescript]: 'ts-node',
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
  const callbacksController = createCallbacksController();
  const functionModule = createFunctionController<ModuleBody>(
    callbacksController.parseArguments,
  );

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
    clearRegisteredCallbacks: () => {
      callbacksController.clearRegisteredCallbacks();
    },
    logBufferedExecutionsTerminated: () => {
      logger.error(
        'There were executions buffered, but the module is not a function anymore. Buffered executions has been forgotten.',
      );
    },
    logCannotRestartKilledModule: () => {
      logger.error('Module killed - cannot restart');
    },
    logFailed: () => logger.error('Exited unexpectedly'),
    logReady: () => logger.info('Ready.'),
    logRestarting: () => logger.info('Restarting..'),
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
    notifyKilled: () => resolveKillRequestPromise(undefined),
    notifyRestarted: () => resolveRestartRequestPromises(),
    notifyRestartFailed: () =>
      rejectRestartRequestPromises(new Error('Module exited unexpectedly')),
    recreateModulePromise,
    rejectExecutionWithInvalidModuleTypeError: ({ executionId, type }) => {
      functionModule.reject(
        executionId,
        new Error(`Cannot execute module of ${type} type`),
      );
    },
    rejectExecutionWithKilledModuleError: ({ executionId }) => {
      functionModule.reject(
        executionId,
        new Error('Cannot execute killed module'),
      );
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
    releaseBufferedExecutions: () => {
      childController.releaseBufferedExecutions(executionData => {
        if (!childProcess) {
          throw noChildProcessError;
        }

        childProcess.send(childController.execute(executionData));
      });
    },
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
      childProcess = fork(
        childPath,
        [cfg.path, JSON.stringify(cfg.transpiler)],
        {
          serialization: 'advanced',
        },
      );
      childProcess.on(
        'message',
        childController.makeMessageHandler({
          async executeCallback({ args, callbackId, executionId }) {
            if (!childProcess) {
              throw noChildProcessError;
            }

            let result = null;
            try {
              const data = await callbacksController.executeCallback(
                callbackId,
                args,
              );
              result = { data, error: false };
            } catch (e) {
              const errorMessage =
                e instanceof Error
                  ? e.message
                  : 'Failed to execute callback passed to the exported function';
              result = { data: errorMessage, error: true };
            }

            childProcess.send(
              childController.callbackExecutionResult({
                executionId,
                result,
              }),
            );
          },
          executionResult({ executionId, result }) {
            childController.resolveExecution({ executionId, result });
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
    terminateBufferedExecutions: () => {
      childController.resolveAllExecutions({
        error: true,
        data: 'Module is not a function. Cannot execute.',
      });
    },
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
