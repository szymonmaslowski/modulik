const assert = require('assert');
const path = require('path');
const { readFileSync, appendFileSync } = require('fs');
const modulik = require('..');
const { wait, scheduler, writeFileAndWait } = require('./utils');

describe('Function module execution', () => {
  afterEach(async () => {
    await scheduler.run();
  });

  it('allows to execute function module', async () => {
    const moduleWatched = modulik('./resources/function-module');
    scheduler.add(async () => {
      await moduleWatched.kill();
    });

    const moduleBody = await moduleWatched.module;
    await moduleBody();
  });

  it('hands over arguments to the module and returns execution result', async () => {
    const moduleWatched = modulik('./resources/function-module');
    scheduler.add(async () => {
      await moduleWatched.kill();
    });

    const moduleBody = await moduleWatched.module;
    const result = await moduleBody(1, 2);
    assert.deepStrictEqual(result, '2 1');
  });

  it('throws when executing killed module', async () => {
    const moduleWatched = modulik('./resources/function-module');
    scheduler.add(async () => {
      await moduleWatched.kill();
    });

    const moduleBody = await moduleWatched.module;
    await moduleWatched.kill();
    try {
      await moduleBody();
    } catch (e) {
      assert.deepStrictEqual(e.message, 'Cannot execute killed module');
      return;
    }
    throw new Error('Module did not throw');
  });

  it('allows to use same module representation function instance after module change', async () => {
    const modulePath = path.resolve(__dirname, 'resources/function-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');
    const functionModulik = modulik(modulePath);
    scheduler.add(async () => {
      await functionModulik.kill();
      await writeFileAndWait(modulePath, moduleContent);
    });

    const func = await functionModulik.module;
    await writeFileAndWait(
      modulePath,
      // eslint-disable-next-line no-template-curly-in-string
      'module.exports = arg => `The arg: ${arg}.`;',
    );
    await functionModulik.module;
    const results = await Promise.all([func(1), func('argument')]);

    assert.deepStrictEqual(results[0], 'The arg: 1.');
    assert.deepStrictEqual(results[1], 'The arg: argument.');
  });

  it('throws an error when trying to execute a module which is not a function anymore', async () => {
    const modulePath = path.resolve(__dirname, 'resources/function-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');
    const functionModulik = modulik(modulePath);
    scheduler.add(async () => {
      await functionModulik.kill();
      await writeFileAndWait(modulePath, moduleContent);
    });

    const func = await functionModulik.module;
    await writeFileAndWait(modulePath, 'module.exports = 1;');
    await functionModulik.module;

    try {
      await func();
    } catch (e) {
      assert.deepStrictEqual(e.message, 'Cannot execute module of number type');
      return;
    }
    throw new Error('Module did not throw');
  });

  it('buffers all execution attempts during module unavailability and executes them once module is ready', async () => {
    const modulePath = path.resolve(
      __dirname,
      'resources/long-evaluable-logging-function-module.js',
    );
    const moduleContent = readFileSync(modulePath, 'utf-8');
    const logFilePath = path.resolve(
      __dirname,
      'resources/buffering-test-log.txt',
    );
    const functionModulik = modulik(modulePath);
    scheduler.add(async () => {
      await functionModulik.kill();
      await writeFileAndWait(modulePath, moduleContent);
      await writeFileAndWait(logFilePath, '');
    });
    const func = await functionModulik.module;

    await writeFileAndWait(logFilePath, '');
    await writeFileAndWait(modulePath, `${moduleContent}\n`);
    // module is being evaluated by 600ms.
    await wait(400);
    const moduleExecutionPromise = func();
    appendFileSync(logFilePath, 'INVOCATION\n');
    await moduleExecutionPromise;
    appendFileSync(logFilePath, 'END OF EXECUTION\n');

    assert.deepStrictEqual(
      readFileSync(logFilePath, 'utf-8'),
      'MODULE START\nINVOCATION\nMODULE STOP\nEND OF EXECUTION\n',
    );
  });

  it('forgets buffered executions if after file change module is no longer a function', async () => {
    const modulePath = path.resolve(
      __dirname,
      'resources/long-evaluable-number-module.js',
    );
    const moduleContent = readFileSync(modulePath, 'utf-8');
    await writeFileAndWait(modulePath, 'module.exports = () => {};');
    const functionModulik = modulik(modulePath);
    scheduler.add(async () => {
      await functionModulik.kill();
    });
    const func = await functionModulik.module;

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
});
