const assert = require('assert');
const path = require('path');
const { existsSync, readFileSync, appendFileSync } = require('fs');
const rimraf = require('rimraf');
const modulik = require('..');
const { wait, spyOn, scheduler, writeFileAndWait } = require('./utils');

afterEach(async () => {
  await scheduler.run();
});
it('executes with minimal params with no problems', async () => {
  const moduleWatched1 = modulik('./resources/number-module');
  const moduleWatched2 = modulik({
    path: './resources/number-module.js',
  });
  scheduler.add(async () => {
    await moduleWatched1.kill();
    await moduleWatched2.kill();
  });

  assert.deepStrictEqual(Boolean(moduleWatched1), true);
  assert.deepStrictEqual(Boolean(moduleWatched2), true);
});
[
  {
    typeName: 'number',
    precondition: 'exports number',
    fileName: 'number-module.js',
    matcher: {
      type: 'number',
      value: 1,
    },
  },
  {
    typeName: 'string',
    precondition: 'exports string',
    fileName: 'string-module.js',
    matcher: {
      type: 'string',
      value: 'module',
    },
  },
  {
    typeName: 'object',
    precondition: 'exports object',
    fileName: 'object-module.js',
    matcher: {
      type: 'object',
      value: {},
    },
  },
  {
    typeName: 'function',
    precondition: 'exports function',
    fileName: 'function-module.js',
    matcher: {
      type: 'function',
      prepare: a => a instanceof Function,
    },
  },
  {
    typeName: 'object',
    precondition: 'does not export anything',
    fileName: 'empty-module.js',
    matcher: {
      type: 'object',
      prepare: a => a instanceof Object,
    },
  },
].forEach(({ typeName, precondition, fileName, matcher }) => {
  it(`exposes ${typeName} under "module" property when module ${precondition}`, async () => {
    const moduleWatched = modulik(`./resources/${fileName}`);
    const exposedModule = await moduleWatched.module;
    scheduler.add(async () => {
      await moduleWatched.kill();
    });

    assert.deepStrictEqual(typeof exposedModule, matcher.type);
    if (matcher.value) {
      assert.deepStrictEqual(exposedModule, matcher.value);
    }
    if (matcher.prepare) {
      assert.deepStrictEqual(matcher.prepare(exposedModule), true);
    }
  });
  it(`exposes ${typeName} under "module" property when module ${precondition} and disable option is set to true`, async () => {
    const moduleWatched = modulik(`./resources/${fileName}`, {
      disable: true,
    });
    const exposedModule = await moduleWatched.module;
    scheduler.add(async () => {
      await moduleWatched.kill();
    });

    assert.deepStrictEqual(typeof exposedModule, matcher.type);
    if (matcher.value) {
      assert.deepStrictEqual(exposedModule, matcher.value);
    }
    if (matcher.prepare) {
      assert.deepStrictEqual(matcher.prepare(exposedModule), true);
    }
  });
});
it('disables logging when quiet property of options is set to true', async () => {
  const spy = spyOn(console, 'info');
  const moduleWatched1 = modulik('./resources/number-module.js', {
    quiet: true,
  });
  const moduleWatched2 = modulik({
    path: './resources/number-module.js',
    quiet: true,
  });
  scheduler.add(async () => {
    spy.free();
    await moduleWatched1.kill();
    await moduleWatched2.kill();
  });

  assert.deepStrictEqual(spy.calls.length, 0);
});
it('disables watching and restarting when disable option is set to true', async () => {
  const filePath = path.resolve(__dirname, 'resources/fs-module.txt');
  const modulePath = path.resolve(__dirname, 'resources/fs-module.js');
  const moduleContent = readFileSync(modulePath, 'utf-8');
  const moduleWatched1 = modulik(modulePath, { disable: true });
  scheduler.add(async () => {
    rimraf.sync(filePath);
    await moduleWatched1.kill();
    await writeFileAndWait(modulePath, moduleContent);
  });

  await moduleWatched1.module;
  rimraf.sync(filePath);
  await writeFileAndWait(modulePath, `${moduleContent}\n`);
  await moduleWatched1.module;

  assert.deepStrictEqual(existsSync(filePath), false);

  const moduleWatched2 = modulik({ path: modulePath, disable: true });
  scheduler.add(async () => {
    await moduleWatched2.kill();
  });

  await moduleWatched2.module;
  rimraf.sync(filePath);
  await writeFileAndWait(modulePath, moduleContent);
  await moduleWatched2.module;

  assert.deepStrictEqual(existsSync(filePath), false);
});
it('restarts module on changes to the file', async () => {
  const filePath = path.resolve(__dirname, 'resources/fs-module.txt');
  const modulePath = path.resolve(__dirname, 'resources/fs-module.js');
  const moduleContent = readFileSync(modulePath, 'utf-8');
  const moduleWatched = modulik(modulePath);
  scheduler.add(async () => {
    rimraf.sync(filePath);
    await moduleWatched.kill();
    await writeFileAndWait(modulePath, moduleContent);
  });

  await moduleWatched.module;
  rimraf.sync(filePath);
  await writeFileAndWait(modulePath, `${moduleContent}\n`);
  await moduleWatched.module;

  assert.deepStrictEqual(existsSync(filePath), true);
});
it('restarts module on changes to files under paths provided by watch option', async () => {
  const filePath = path.resolve(__dirname, 'resources/fs-module.txt');
  const module1Path = './resources/empty-module.js';
  const module1FullPath = path.resolve(__dirname, module1Path);
  const module2Path = path.resolve(__dirname, 'resources/function-module.js');
  const module1Content = readFileSync(module1FullPath, 'utf-8');
  const module2Content = readFileSync(module2Path, 'utf-8');
  const moduleWatched = modulik('./resources/fs-module.js', {
    watch: [module1Path, module2Path],
  });
  scheduler.add(async () => {
    rimraf.sync(filePath);
    await moduleWatched.kill();
    await writeFileAndWait(module1FullPath, module1Content);
  });

  await moduleWatched.module;
  rimraf.sync(filePath);
  await writeFileAndWait(module1FullPath, `${module1Content}\n`);
  await moduleWatched.module;

  assert.deepStrictEqual(existsSync(filePath), true);

  rimraf.sync(filePath);
  scheduler.add(async () => {
    await writeFileAndWait(module2Path, module2Content);
  });
  await writeFileAndWait(module2Path, `${module2Content}\n`);
  await moduleWatched.module;

  assert.deepStrictEqual(existsSync(filePath), true);
});
it('restarts module when "restart" method was invoked', async () => {
  const filePath = path.resolve(__dirname, 'resources/fs-module.txt');
  rimraf.sync(filePath);
  const moduleWatched = modulik('./resources/fs-module');
  scheduler.add(async () => {
    rimraf.sync(filePath);
    await moduleWatched.kill();
  });

  await moduleWatched.module;
  rimraf.sync(filePath);
  await moduleWatched.restart();
  await moduleWatched.module;

  assert.deepStrictEqual(existsSync(filePath), true);
});
it('allows to call "restart" method even when disable option is set to true', async () => {
  const moduleWatched = modulik('./resources/number-module.js', {
    disable: true,
  });
  scheduler.add(async () => {
    await moduleWatched.kill();
  });
  await moduleWatched.restart();
  await moduleWatched.module;
});
it('allows to call "restart" method even when module is already killed', async () => {
  const moduleWatched = modulik('./resources/number-module');
  await moduleWatched.kill();
  await moduleWatched.restart();
});
it('allows to access killed module', async () => {
  const moduleWatched = modulik('./resources/number-module');
  await moduleWatched.kill();

  try {
    await moduleWatched.module;
  } catch (e) {
    throw new Error('Module thrown');
  }
});
it('throws when executing killed module', async () => {
  const moduleWatched = modulik('./resources/function-module');
  await moduleWatched.kill();
  try {
    const moduleBody = await moduleWatched.module;
    await moduleBody();
  } catch (e) {
    assert.deepStrictEqual(e.message, 'Cannot execute killed module');
    return;
  }
  throw new Error('Module did not throw');
});
it('causes module to stop watching for changes when "kill" method was invoked', async () => {
  const filePath = path.resolve(__dirname, 'resources/fs-module.txt');
  const modulePath = path.resolve(__dirname, 'resources/fs-module.js');
  const moduleContent = readFileSync(modulePath, 'utf-8');
  const moduleWatched = modulik(modulePath);
  await moduleWatched.module;
  rimraf.sync(filePath);
  scheduler.add(async () => {
    rimraf.sync(filePath);
    await moduleWatched.kill();
    await writeFileAndWait(modulePath, moduleContent);
  });

  await moduleWatched.kill();
  await writeFileAndWait(modulePath, `${moduleContent}\n`);
  await moduleWatched.module;

  assert.deepStrictEqual(existsSync(filePath), false);
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
  const func = await functionModulik.module;
  scheduler.add(async () => {
    await functionModulik.kill();
    await writeFileAndWait(modulePath, moduleContent);
    await writeFileAndWait(logFilePath, '');
  });

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
  const func = await functionModulik.module;
  scheduler.add(async () => {
    await functionModulik.kill();
  });

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
