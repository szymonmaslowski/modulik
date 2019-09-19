const { resolve } = require('path');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const rimraf = require('rimraf');
const modulik = require('..');

const wait = ms =>
  new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });

describe('the module', () => {
  it('executes with minimal params with no problems', async done => {
    const moduleWatched1 = modulik('./resources/number-module.js');
    const moduleWatched2 = modulik({
      path: './resources/number-module.js',
    });

    expect(moduleWatched1).toBeTruthy();
    expect(moduleWatched2).toBeTruthy();

    await moduleWatched1.kill();
    await moduleWatched2.kill();
    done();
  });
  [
    {
      typeName: 'number',
      fileName: 'number-module.js',
      matcher: {
        type: 'number',
        value: 1,
      },
    },
    {
      typeName: 'string',
      fileName: 'string-module.js',
      matcher: {
        type: 'string',
        value: 'module',
      },
    },
    {
      typeName: 'object',
      fileName: 'object-module.js',
      matcher: {
        type: 'object',
        value: {},
      },
    },
    {
      typeName: 'function',
      fileName: 'function-module.js',
      matcher: {
        type: 'function',
        value: expect.any(Function),
      },
    },
  ].forEach(({ typeName, fileName, matcher }) => {
    it(`exposes ${typeName} under "module" property when module exports ${typeName}`, async done => {
      const moduleWatched = modulik(`./resources/${fileName}`);
      const exposedModule = await moduleWatched.module;
      expect(typeof exposedModule).toEqual(matcher.type);
      expect(exposedModule).toEqual(matcher.value);
      await moduleWatched.kill();
      done();
    });
    it(`exposes ${typeName} under "module" property when module exports ${typeName} and disable option is set to true`, async done => {
      const moduleWatched = modulik(`./resources/${fileName}`, {
        disable: true,
      });
      const exposedModule = await moduleWatched.module;
      expect(typeof exposedModule).toEqual(matcher.type);
      expect(exposedModule).toEqual(matcher.value);
      await moduleWatched.kill();
      done();
    });
  });
  it('exposes object under "module" property when module does not export anything', async done => {
    const moduleWatched = modulik('./resources/empty-module.js');
    const exposedModule = await moduleWatched.module;
    expect(typeof exposedModule).toEqual('object');
    expect(exposedModule).toEqual(expect.any(Object));
    await moduleWatched.kill();
    done();
  });
  it('exposes object under "module" property when module does not export anything and disable option is set to true', async done => {
    const moduleWatched = modulik('./resources/empty-module.js', {
      disable: true,
    });
    const exposedModule = await moduleWatched.module;
    expect(typeof exposedModule).toEqual('object');
    expect(exposedModule).toEqual(expect.any(Object));
    await moduleWatched.kill();
    done();
  });
  it('disables logging when quiet property of options is set to true', async done => {
    const spy = jest.spyOn(console, 'info');
    const moduleWatched1 = modulik('./resources/number-module.js', {
      quiet: true,
    });
    const moduleWatched2 = modulik({
      path: './resources/number-module.js',
      quiet: true,
    });

    expect(spy).toHaveBeenCalledTimes(0);

    await moduleWatched1.kill();
    await moduleWatched2.kill();
    spy.mockRestore();
    done();
  });
  it('disables watching and restarting when disable option is set to true', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = resolve(__dirname, 'resources/fs-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');

    const moduleWatched1 = modulik(modulePath, { disable: true });
    await moduleWatched1.module;
    rimraf.sync(filePath);
    writeFileSync(modulePath, `${moduleContent}\n`);
    await wait(1000);

    expect(existsSync(filePath)).toBeFalsy();

    const moduleWatched2 = modulik({ path: modulePath, disable: true });
    await moduleWatched2.module;
    rimraf.sync(filePath);
    writeFileSync(modulePath, moduleContent);
    await moduleWatched1.module;

    expect(existsSync(filePath)).toBeFalsy();

    await moduleWatched1.kill();
    await moduleWatched2.kill();
    done();
  });
  it('restarts module on changes to the file', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = resolve(__dirname, 'resources/fs-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');

    const moduleWatched = modulik(modulePath);
    await moduleWatched.module;
    rimraf.sync(filePath);
    writeFileSync(modulePath, `${moduleContent}\n`);
    await wait(1000);

    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    await moduleWatched.kill();
    writeFileSync(modulePath, moduleContent);
    done();
  });
  it('restarts module on changes to files under paths provided by watch option', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');
    const module1Path = './resources/empty-module.js';
    const module2Path = resolve(__dirname, 'resources/function-module.js');
    const module1Content = readFileSync(
      resolve(__dirname, module1Path),
      'utf-8',
    );
    const module2Content = readFileSync(module2Path, 'utf-8');

    const moduleWatched = modulik('./resources/fs-module.js', {
      watch: [module1Path, module2Path],
    });
    await moduleWatched.module;
    rimraf.sync(filePath);
    writeFileSync(resolve(__dirname, module1Path), `${module1Content}\n`);
    await wait(1000);

    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    writeFileSync(module2Path, `${module2Content}\n`);
    await wait(1000);

    expect(existsSync(filePath)).toBeTruthy();

    await moduleWatched.kill();
    writeFileSync(resolve(__dirname, module1Path), module1Content);
    writeFileSync(module2Path, module2Content);
    done();
  });
  it('restarts module when "restart" method was invoked', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');

    rimraf.sync(filePath);
    const moduleWatched = modulik('./resources/fs-module.js');
    await moduleWatched.module;
    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    moduleWatched.restart();
    await moduleWatched.module;
    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    await moduleWatched.kill();
    done();
  });
  it('allows to call "restart" method even when disable option is set to true', async done => {
    const moduleWatched = modulik('./resources/number-module.js', {
      disable: true,
    });
    await moduleWatched.module;
    await moduleWatched.restart();
    await moduleWatched.kill();
    done();
  });
  it('allows to call "restart" method even when module is already killed', async done => {
    const moduleWatched = modulik('./resources/number-module.js');
    await moduleWatched.kill();
    await moduleWatched.kill();
    done();
  });
  it('allows to access killed module', async done => {
    const moduleWatched = modulik('./resources/number-module.js');
    await moduleWatched.kill();
    try {
      await moduleWatched.module;
    } catch (e) {
      done(new Error('Module thrown'));
      return;
    }
    done();
  });
  it('throws when executing killed module', async done => {
    const moduleWatched = modulik('./resources/function-module.js');
    await moduleWatched.kill();
    try {
      const moduleBody = await moduleWatched.module;
      await moduleBody();
    } catch (e) {
      expect(e).toEqual(new Error('Cannot execute killed module'));
      done();
      return;
    }
    done(new Error('Module did not throw'));
  });
  it('causes module to stop watching for changes when "kill" method was invoked', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = resolve(__dirname, 'resources/fs-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');

    const moduleWatched = modulik(modulePath);
    await moduleWatched.module;
    rimraf.sync(filePath);
    await moduleWatched.kill();
    writeFileSync(modulePath, `${moduleContent}\n`);
    await wait(1000);

    expect(existsSync(filePath)).toBeFalsy();

    await moduleWatched.kill();
    writeFileSync(modulePath, moduleContent);
    done();
  });
});
