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
import createFunctionController, {
  FunctionModuleExecutionCallback,
} from '../functionModuleController';
import createState from '../state';
import { PromiseReject, PromiseResolve, TranspilerType } from '../types';
import createLogger from './logger';
import { Args, LaunchApi } from './types';
import {
  doesModuleHaveAnyNamedExportedFunction,
  executeModuleFunction,
  getNamedExportedFunctionsFromModule,
  isEntityAFunctionRepresentation,
} from '../utils';

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
    bufferExecution: ({ args, executionId, functionId }) => {
      childController.bufferExecution({
        args,
        functionId,
        callback: (error, data) => {
          if (error) {
            functionModule.rejectExecution(executionId, error);
            return;
          }
          functionModule.resolveExecution(executionId, data);
        },
      });
    },
    clearRegisteredCallbacks: () => {
      callbacksController.clearRegisteredCallbacks();
    },
    logBufferedExecutionsTerminated: () => {
      logger.error(
        'At least one function exported from the module is not available anymore. Its buffered executions has been forgotten.',
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
      functionModule.rejectExecution(
        executionId,
        new Error(`Cannot execute module of ${type} type`),
      );
    },
    rejectExecutionWithKilledModuleError: ({ executionId }) => {
      functionModule.rejectExecution(
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
    releaseBufferedExecutions: ({ functionId }) => {
      childController.releaseBufferedExecutions(functionId, executionData => {
        if (!childProcess) {
          throw noChildProcessError;
        }

        childProcess.send(childController.execute(executionData));
      });
    },
    resolveModule: ({ body }) => {
      const functionModuleWrapperCallback: FunctionModuleExecutionCallback = ({
        args,
        executionId,
        functionId,
      }) => {
        state.execute({ args, executionId, functionId });
      };

      if (isEntityAFunctionRepresentation(body)) {
        const functionModuleWrapper = functionModule.create(
          'default',
          functionModuleWrapperCallback,
        );

        // @ts-ignore FIXME: TS doesn't understand that runtime `type` variable identifies the module body as a function
        resolveModule(functionModuleWrapper);
        return;
      }

      let targetBody = body;

      if (doesModuleHaveAnyNamedExportedFunction(body)) {
        (function substituteNamedExportedFunctionsWithWrappers() {
          targetBody = getNamedExportedFunctionsFromModule(body).reduce(
            (acc, { name }) => {
              acc[name] = functionModule.create(
                name,
                functionModuleWrapperCallback,
              );
              return acc;
            },
            { ...body },
          );
        })();
      }

      resolveModule(targetBody);
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
          async executeCallback({ args, callbackId, executionId }) {
            if (!childProcess) {
              throw noChildProcessError;
            }

            const result = await executeModuleFunction(
              () => callbacksController.executeCallback(callbackId, args),
              'Failed to execute callback passed to the exported function',
            );

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
          ready: ({ body, serializable }) => {
            state.ready({ body, serializable });
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
    terminateBufferedExecutions: ({ functionId }) => {
      childController.resolveAllExecutions(functionId, {
        error: true,
        data: 'Module is not a function. Cannot execute.',
        serializable: true,
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
