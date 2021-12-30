const assert = require('assert');
const path = require('path');
const { readFileSync } = require('fs');
const modulik = require('../modulik');
const { scheduler, writeFileAndWait, deleteFileAndWait } = require('./utils');

describe('Module availability', () => {
  afterEach(async () => {
    await scheduler.run();
  });

  it('throws when accessing a module if that module throws after a file change', async () => {
    const modulePath = path.resolve(__dirname, 'resources/number-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');
    const numberModulik = modulik(modulePath);
    scheduler.add(async () => {
      await numberModulik.kill();
      await writeFileAndWait(modulePath, moduleContent);
    });

    await numberModulik.module;
    await writeFileAndWait(modulePath, "throw new Error('Cannot execute');");
    try {
      await numberModulik.module;
    } catch (e) {
      assert.deepStrictEqual(e.message, 'Module exited unexpectedly');
      return;
    }
    throw new Error('Module did not throw');
  });

  it('throws when accessing a module if the file of that module has been deleted', async () => {
    const modulePath = path.resolve(__dirname, 'resources/number-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');
    const numberModulik = modulik(modulePath);
    scheduler.add(async () => {
      await numberModulik.kill();
      await writeFileAndWait(modulePath, moduleContent);
    });

    await numberModulik.module;
    await deleteFileAndWait(modulePath);
    try {
      await numberModulik.module;
    } catch (e) {
      assert.deepStrictEqual(e.message, 'Module exited unexpectedly');
      return;
    }
    throw new Error('Module did not throw');
  });

  it('exposes a module after a restart if it is evaluable but was not before', async () => {
    const modulePath = path.resolve(__dirname, 'resources/number-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');
    await deleteFileAndWait(modulePath);
    const numberModulik = modulik(modulePath);
    scheduler.add(async () => {
      await numberModulik.kill();
      await writeFileAndWait(modulePath, moduleContent);
    });

    try {
      await numberModulik.module;
      // eslint-disable-next-line no-empty
    } catch (e) {}

    await writeFileAndWait(modulePath, moduleContent);
    const exposedModule = await numberModulik.module;
    assert.deepStrictEqual(exposedModule, 1);
  });

  it('allows to access killed module if module was accessible before', async () => {
    const moduleWatched = modulik('./resources/number-module');
    scheduler.add(async () => {
      await moduleWatched.kill();
    });
    await moduleWatched.module;

    try {
      await moduleWatched.module;
    } catch (e) {
      throw new Error('Module threw');
    }
  });

  it('throws when accessing killed module if module was not accessible before', async () => {
    const moduleWatched = modulik('./resources/number-module');
    await moduleWatched.kill();

    try {
      await moduleWatched.module;
    } catch (e) {
      assert.deepStrictEqual(e.message, 'Module unavailable');
      return;
    }
    throw new Error('Module did not throw');
  });
});
