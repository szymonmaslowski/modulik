const assert = require('assert');
const fs = require('fs');
const modulik = require('modulik');
const path = require('path');
const { wait, scheduler, writeFileAndWait } = require('../utils');

const getters = [
  async i => i.module,
  async i => (await i.module).named,
  // async i => (await i.module)(),
  // async i => (await i.module)().named,
];
const names = [
  'exported as default',
  'exported as named export',
  // 'returned from function',
  // 'returned from function in object',
];
const runOverModulesWithDifferentExports = async (
  pathsOrInstanceBuilders,
  callback,
) => {
  pathsOrInstanceBuilders.forEach((modulePathOrInstanceBuilder, i) => {
    const createInstance =
      typeof modulePathOrInstanceBuilder === 'string'
        ? () => modulik(modulePathOrInstanceBuilder)
        : modulePathOrInstanceBuilder;
    const getFn = getters[i];
    const name = names[i];
    callback({ createInstance, getFn, name });
  });
};

describe('Function module execution', () => {
  afterEach(async () => {
    await scheduler.run();
  });

  runOverModulesWithDifferentExports(
    [
      './resources/function-module',
      './resources/function-named-exported-module',
    ],
    ({ createInstance, getFn, name }) => {
      it(`allows to be executed - ${name}`, async () => {
        const instance = createInstance();
        scheduler.add(async () => {
          await instance.kill();
        });

        const fn = await getFn(instance);
        await fn(1, 2);
      });
    },
  );

  runOverModulesWithDifferentExports(
    [
      './resources/function-module',
      './resources/function-named-exported-module',
    ],
    ({ createInstance, getFn, name }) => {
      it(`hands over arguments and returns execution result - ${name}`, async () => {
        const instance = createInstance();
        scheduler.add(async () => {
          await instance.kill();
        });

        const fn = await getFn(instance);
        const result = await fn(1, 2);
        assert.deepStrictEqual(result, '2 1');
      });
    },
  );

  runOverModulesWithDifferentExports(
    [
      './resources/callbacks-function-module',
      './resources/callbacks-named-exported-function-module',
    ],
    ({ createInstance, getFn, name }) => {
      it(`supports callback arguments - ${name}`, async () => {
        const logFilePath = path.resolve(
          __dirname,
          'resources/callbacks-log.txt',
        );
        const instance = createInstance();
        scheduler.add(async () => {
          await writeFileAndWait(logFilePath, '');
          await instance.kill();
        });

        const exposedFunction = await getFn(instance);
        await exposedFunction(
          'result-type',
          () => true,
          [() => 'two', () => 3],
          {
            cb4: () => null,
            cb5: () => {},
          },
        );

        const logFileContent = fs.readFileSync(logFilePath, 'utf-8');
        assert.deepStrictEqual(
          logFileContent,
          "boolean true,string 'two',number 3,object null,undefined undefined",
        );
      });
    },
  );

  runOverModulesWithDifferentExports(
    [
      './resources/returning-map-function-module',
      './resources/returning-map-named-exported-function-module',
    ],
    ({ createInstance, getFn, name }) => {
      it(`is able to return advanced types as execution result - ${name}`, async () => {
        const instance = createInstance();
        scheduler.add(async () => {
          await instance.kill();
        });

        const fn = await getFn(instance);
        assert.deepStrictEqual(await fn(), new Map([[{}, new Map()]]));
      });
    },
  );

  runOverModulesWithDifferentExports(
    [
      './resources/callbacks-function-module',
      './resources/callbacks-named-exported-function-module',
    ],
    ({ createInstance, getFn, name }) => {
      it(`is able to transfer to the child advanced types returned from passed callbacks - ${name}`, async () => {
        const logFilePath = path.resolve(
          __dirname,
          'resources/callbacks-log.txt',
        );
        const instance = createInstance();
        scheduler.add(async () => {
          await instance.kill();
          await writeFileAndWait(logFilePath, '');
        });

        const exposedFunction = await getFn(instance);
        await exposedFunction(
          'result-type',
          () => /test/,
          [() => Buffer.from('test'), () => new Int8Array([1, 2])],
          {
            cb4: () => new Map([[{}, new Set([true])]]),
            cb5: () => new Error('Test'),
          },
        );

        const firstLineOfLogFile = fs
          .readFileSync(logFilePath, 'utf-8')
          .split('\n')[0];
        assert.deepStrictEqual(
          firstLineOfLogFile,
          `object /test/,object <Buffer 74 65 73 74>,object Int8Array(2) [ 1, 2 ],object Map(1) { {} => Set(1) { true } },object Error: Test`,
        );
      });
    },
  );

  runOverModulesWithDifferentExports(
    [
      './resources/function-module',
      './resources/function-named-exported-module',
    ],
    ({ createInstance, getFn, name }) => {
      it(`throws when executing while the module has been killed - ${name}`, async () => {
        const instance = createInstance();
        scheduler.add(async () => {
          await instance.kill();
        });

        const fn = await getFn(instance);
        await instance.kill();

        try {
          await fn();
        } catch (e) {
          assert.deepStrictEqual(e.message, 'Cannot execute killed module');
          return;
        }
        throw new Error('Module did not throw');
      });
    },
  );

  runOverModulesWithDifferentExports(
    [
      './resources/function-module',
      () =>
        modulik('./resources/function-named-exported-module', {
          watch: ['./resources/function-module'],
        }),
    ],
    ({ createInstance, getFn, name }) => {
      it(`allows to use same module representation function instance after module change - ${name}`, async () => {
        const functionModuleFilePath = path.resolve(
          __dirname,
          'resources/function-module.js',
        );
        const moduleContent = fs.readFileSync(functionModuleFilePath, 'utf-8');
        const instance = createInstance();
        scheduler.add(async () => {
          await instance.kill();
          await writeFileAndWait(functionModuleFilePath, moduleContent);
        });

        const fn = await getFn(instance);
        await writeFileAndWait(
          functionModuleFilePath,
          // eslint-disable-next-line no-template-curly-in-string
          'module.exports = arg => `The arg: ${arg}.`;',
        );
        await instance.module;
        const results = await Promise.all([fn(1), fn('argument')]);

        assert.deepStrictEqual(results[0], 'The arg: 1.');
        assert.deepStrictEqual(results[1], 'The arg: argument.');
      });
    },
  );

  runOverModulesWithDifferentExports(
    [
      './resources/function-module',
      () =>
        modulik('./resources/function-named-exported-module', {
          watch: ['./resources/function-module'],
        }),
    ],
    ({ createInstance, getFn, name }) => {
      it(`throws an error when trying to execute a module which is not a function anymore - ${name}`, async () => {
        const functionModuleFilePath = path.resolve(
          __dirname,
          'resources/function-module.js',
        );
        const moduleContent = fs.readFileSync(functionModuleFilePath, 'utf-8');
        const instance = createInstance();
        scheduler.add(async () => {
          await instance.kill();
          await writeFileAndWait(functionModuleFilePath, moduleContent);
        });

        const fn = await getFn(instance);
        await writeFileAndWait(functionModuleFilePath, 'module.exports = 1;');
        await instance.module;

        try {
          await fn();
        } catch (e) {
          assert.deepStrictEqual(
            e.message,
            'Cannot execute module of number type',
          );

          await instance.kill();
          await writeFileAndWait(functionModuleFilePath, moduleContent);
          return;
        }
        throw new Error('Module did not throw');
      });
    },
  );

  runOverModulesWithDifferentExports(
    [
      './resources/long-evaluable-logging-function-module',
      () =>
        modulik(
          './resources/long-evaluable-logging-named-exported-function-module',
          {
            watch: ['./resources/long-evaluable-logging-function-module'],
          },
        ),
    ],
    ({ createInstance, getFn, name }) => {
      it(`buffers all execution attempts during module unavailability and executes them once module is ready - ${name}`, async () => {
        const longEvaluableModuleFilePath = path.resolve(
          __dirname,
          'resources/long-evaluable-logging-function-module.js',
        );
        const moduleContent = fs.readFileSync(
          longEvaluableModuleFilePath,
          'utf-8',
        );
        const logFilePath = path.resolve(
          __dirname,
          'resources/buffering-test-log.txt',
        );
        const instance = createInstance();
        scheduler.add(async () => {
          await instance.kill();
          await writeFileAndWait(longEvaluableModuleFilePath, moduleContent);
          await writeFileAndWait(logFilePath, '');
        });

        const fn = await getFn(instance);

        await writeFileAndWait(logFilePath, '');
        await writeFileAndWait(
          longEvaluableModuleFilePath,
          `${moduleContent}\n`,
        );
        // module is being evaluated by 600ms.
        await wait(400);
        const moduleExecutionPromise = fn();
        fs.appendFileSync(logFilePath, 'INVOCATION\n');
        await moduleExecutionPromise;
        fs.appendFileSync(logFilePath, 'END OF EXECUTION\n');

        assert.deepStrictEqual(
          fs.readFileSync(logFilePath, 'utf-8'),
          'MODULE START\nINVOCATION\nMODULE STOP\nEND OF EXECUTION\n',
        );
      });
    },
  );

  runOverModulesWithDifferentExports(
    [
      './resources/long-evaluable-number-module',
      () =>
        modulik('./resources/long-evaluable-named-exported-number-module', {
          watch: ['./resources/long-evaluable-number-module'],
        }),
    ],
    ({ createInstance, getFn, name }) => {
      it(`forgets buffered executions if after file change exported entity is no longer a function - ${name}`, async () => {
        const modulePath = path.resolve(
          __dirname,
          'resources/long-evaluable-number-module.js',
        );
        const moduleContent = fs.readFileSync(modulePath, 'utf-8');
        await writeFileAndWait(modulePath, 'module.exports = () => {};');
        const instance = createInstance();
        scheduler.add(async () => {
          await instance.kill();
          await writeFileAndWait(modulePath, moduleContent);
        });
        const func = await getFn(instance);

        await writeFileAndWait(modulePath, moduleContent);
        // module is being evaluated by 600s.
        await wait(400);

        try {
          await func();
        } catch (e) {
          assert.deepStrictEqual(
            e.message,
            'Module is not a function. Cannot execute.',
          );
          return;
        }
        throw new Error('Module did not throw');
      });
    },
  );
});
