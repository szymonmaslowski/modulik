const assert = require('assert');
const EventEmitter = require('events');
const { resolve } = require('path');
const { existsSync, readFileSync } = require('fs');
const modulik = require('..');
const {
  spyOn,
  writeFileAndWait,
  scheduler,
  deleteFileAndWait,
} = require('./utils');

describe('API', () => {
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
    const fsArtifactPath = resolve(__dirname, 'resources/fs-artifact.txt');
    const module1Path = resolve(__dirname, 'resources/object-module.js');
    const module2Path = resolve(__dirname, 'resources/empty-module.js');
    const module1Content = readFileSync(module1Path, 'utf-8');
    const module2Content = readFileSync(module2Path, 'utf-8');
    const spy = spyOn(console, 'info');
    await deleteFileAndWait(fsArtifactPath);

    const moduleWatched = modulik(
      {
        path: './resources/number-module',
        watch: [module1Path],
        disabled: true,
        quiet: true,
      },
      {
        path: './resources/fs-module',
        watch: [module2Path],
        disabled: false,
        quiet: false,
      },
    );

    scheduler.add(async () => {
      spy.free();
      await moduleWatched.kill();
      await deleteFileAndWait(fsArtifactPath);
      await writeFileAndWait(module1Path, module1Content);
      await writeFileAndWait(module2Path, module2Content);
    });

    const exposedModule = await moduleWatched.module;
    assert.deepStrictEqual(exposedModule, {});
    assert.deepStrictEqual(existsSync(fsArtifactPath), true);

    await deleteFileAndWait(fsArtifactPath);
    await writeFileAndWait(module1Path, `${module1Content}\n`);
    await moduleWatched.module;
    assert.deepStrictEqual(existsSync(fsArtifactPath), false);

    await writeFileAndWait(module2Path, `${module2Content}\n`);
    await moduleWatched.module;

    assert.deepStrictEqual(existsSync(fsArtifactPath), true);
    assert.deepStrictEqual(spy.calls.length, 3);
  });

  it('allows for absolute path to module', async () => {
    const fsArtifactPath = resolve(__dirname, 'resources/fs-artifact.txt');
    const modulePath = resolve(__dirname, 'resources/fs-module');

    const moduleWatched1 = modulik(modulePath);
    scheduler.add(async () => {
      await deleteFileAndWait(fsArtifactPath);
      await moduleWatched1.kill();
    });
    await moduleWatched1.module;
    assert.deepStrictEqual(existsSync(fsArtifactPath), true);

    await deleteFileAndWait(fsArtifactPath);
    const moduleWatched2 = modulik({ path: modulePath });
    scheduler.add(async () => {
      await deleteFileAndWait(fsArtifactPath);
      await moduleWatched2.kill();
    });
    await moduleWatched2.module;
    assert.deepStrictEqual(existsSync(fsArtifactPath), true);
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

  it('created object is extends EventEmitter', async () => {
    const moduleWatched = modulik('./resources/number-module');
    scheduler.add(async () => {
      await moduleWatched.kill();
    });
    assert.deepStrictEqual(moduleWatched instanceof EventEmitter, true);
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
});
