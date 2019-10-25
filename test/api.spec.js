const assert = require('assert');
const { resolve } = require('path');
const { existsSync, readFileSync } = require('fs');
const rimraf = require('rimraf');
const modulik = require('..');
const { spyOn, writeFileAndWait, scheduler } = require('./utils');

afterEach(async () => {
  await scheduler.run();
});
it('is of function type', () => {
  assert.deepStrictEqual(modulik instanceof Function, true);
});
it('accepts module path option as first argument', async () => {
  const moduleWatched = modulik('./resources/number-module');
  scheduler.add(async () => {
    await moduleWatched.kill();
  });
  const exposedModule = await moduleWatched.module;
  assert.deepStrictEqual(exposedModule, 1);
});
it('accepts options object as first argument', async () => {
  const moduleWatched = modulik({ path: './resources/number-module.js' });
  scheduler.add(async () => {
    await moduleWatched.kill();
  });
  const exposedModule = await moduleWatched.module;
  assert.deepStrictEqual(exposedModule, 1);
});
it('prioritises options object provided as second argument', async () => {
  const filePath = resolve(__dirname, 'resources/fs-module.txt');
  const module1Path = resolve(__dirname, 'resources/object-module.js');
  const module2Path = resolve(__dirname, 'resources/empty-module.js');
  const module1Content = readFileSync(module1Path, 'utf-8');
  const module2Content = readFileSync(module2Path, 'utf-8');
  const spy = spyOn(console, 'info');
  rimraf.sync(filePath);

  const moduleWatched = modulik(
    {
      path: './resources/number-module',
      watch: [module1Path],
      disable: true,
      quiet: true,
    },
    {
      path: './resources/fs-module',
      watch: [module2Path],
      disable: false,
      quiet: false,
    },
  );

  scheduler.add(async () => {
    spy.free();
    await moduleWatched.kill();
    rimraf.sync(filePath);
    await writeFileAndWait(module1Path, module1Content);
    await writeFileAndWait(module2Path, module2Content);
  });

  const exposedModule = await moduleWatched.module;
  assert.deepStrictEqual(exposedModule, {});
  assert.deepStrictEqual(existsSync(filePath), true);

  rimraf.sync(filePath);
  await writeFileAndWait(module1Path, `${module1Content}\n`);
  await moduleWatched.module;
  assert.deepStrictEqual(existsSync(filePath), false);

  await writeFileAndWait(module2Path, `${module2Content}\n`);
  await moduleWatched.module;
  assert.deepStrictEqual(existsSync(filePath), true);
  assert.deepStrictEqual(spy.calls.length, 3);
});
it('allows for absolute path to module', async () => {
  const filePath = resolve(__dirname, 'resources/fs-module.txt');
  const modulePath = resolve(__dirname, 'resources/fs-module');

  const moduleWatched1 = modulik(modulePath);
  scheduler.add(async () => {
    rimraf.sync(filePath);
    await moduleWatched1.kill();
  });
  await moduleWatched1.module;
  assert.deepStrictEqual(existsSync(filePath), true);

  rimraf.sync(filePath);
  const moduleWatched2 = modulik({ path: modulePath });
  scheduler.add(async () => {
    rimraf.sync(filePath);
    await moduleWatched2.kill();
  });
  await moduleWatched2.module;
  assert.deepStrictEqual(existsSync(filePath), true);
});
it('allows to skip extension in module path when the file has js or json extension', async () => {
  const numberModulik = modulik('./resources/number-module');
  const jsonModulik = modulik('./resources/json-module');

  scheduler.add(async () => {
    await numberModulik.kill();
    await jsonModulik.kill();
  });

  const numberModuleValue = await numberModulik.module;
  const jsonModuleValue = await jsonModulik.module;

  assert.deepStrictEqual(numberModuleValue, 1);
  assert.deepStrictEqual(jsonModuleValue, { example: 'json' });
});
it('creates object', async () => {
  const moduleWatched = modulik('./resources/number-module');
  scheduler.add(async () => {
    await moduleWatched.kill();
  });
  assert.deepStrictEqual(moduleWatched instanceof Object, true);
});
it('exposes "module" property on created object', async () => {
  const moduleWatched = modulik('./resources/number-module');
  scheduler.add(async () => {
    await moduleWatched.kill();
  });
  assert.deepStrictEqual(Boolean(moduleWatched.module), true);
  assert.deepStrictEqual(moduleWatched.module instanceof Promise, true);
});
it('exposes "restart" method on created object', async () => {
  const moduleWatched = modulik('./resources/number-module');
  scheduler.add(async () => {
    await moduleWatched.kill();
  });
  assert.deepStrictEqual(Boolean(moduleWatched.restart), true);
  assert.deepStrictEqual(moduleWatched.restart instanceof Function, true);
});
it('exposes "kill" method on created object', async () => {
  const moduleWatched = modulik('./resources/number-module');
  scheduler.add(async () => {
    await moduleWatched.kill();
  });
  assert.deepStrictEqual(Boolean(moduleWatched.kill), true);
  assert.deepStrictEqual(moduleWatched.kill instanceof Function, true);
});
it('provides promise api for executing function-type module', async () => {
  const funcModulik = modulik('./resources/function-module');
  scheduler.add(async () => {
    await funcModulik.kill();
  });
  const func = await funcModulik.module;
  assert.deepStrictEqual(func() instanceof Promise, true);
});
