const { resolve } = require('path');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const rimraf = require('rimraf');
const modulik = require('..');

const wait = ms =>
  new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });

describe('the module', () => {
  it('is of function type', () => {
    expect(modulik).toEqual(expect.any(Function));
  });
  it('accepts module path option as first argument', async done => {
    const moduleWatched = modulik('./resources/number-module');
    const exposedModule = await moduleWatched.module;
    expect(exposedModule).toEqual(1);
    await moduleWatched.kill();
    done();
  });
  it('accepts options object as first argument', async done => {
    const moduleWatched = modulik({ path: './resources/number-module.js' });
    const exposedModule = await moduleWatched.module;
    expect(exposedModule).toEqual(1);
    await moduleWatched.kill();
    done();
  });
  it('prioritises options object provided as second argument', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');
    const module1Path = resolve(__dirname, 'resources/object-module.js');
    const module2Path = resolve(__dirname, 'resources/empty-module.js');
    const module1Content = readFileSync(module1Path, 'utf-8');
    const module2Content = readFileSync(module2Path, 'utf-8');
    const spy = jest.spyOn(console, 'info');
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
    const exposedModule = await moduleWatched.module;

    expect(exposedModule).toEqual({});
    expect(existsSync(filePath)).toBeTruthy();
    rimraf.sync(filePath);
    writeFileSync(module1Path, `${module1Content}\n`);
    await wait(1000);
    await moduleWatched.module;
    expect(existsSync(filePath)).not.toBeTruthy();
    writeFileSync(module2Path, `${module2Content}\n`);
    await wait(1000);
    await moduleWatched.module;
    expect(existsSync(filePath)).toBeTruthy();
    expect(spy).toHaveBeenCalledTimes(3);

    await moduleWatched.kill();
    rimraf.sync(filePath);
    writeFileSync(module1Path, module1Content);
    writeFileSync(module2Path, module2Content);
    done();
  });
  it('allows for absolute path to module', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = resolve(__dirname, 'resources/fs-module');

    const moduleWatched1 = modulik(modulePath);
    await moduleWatched1.module;
    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    const moduleWatched2 = modulik({ path: modulePath });
    await moduleWatched2.module;
    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    await moduleWatched1.kill();
    await moduleWatched2.kill();
    done();
  });
  it('allows to skip extension in module path when the file has js or json extension', async done => {
    const numberModulik = modulik('./resources/number-module');
    const jsonModulik = modulik('./resources/json-module');

    const numberModuleValue = await numberModulik.module;
    const jsonModuleValue = await jsonModulik.module;
    expect(numberModuleValue).toEqual(1);
    expect(jsonModuleValue).toEqual({ example: 'json' });

    await numberModulik.kill();
    await jsonModulik.kill();
    done();
  });
  it('creates object', async done => {
    const moduleWatched = modulik('./resources/number-module');
    expect(moduleWatched).toEqual(expect.any(Object));
    await moduleWatched.kill();
    done();
  });
  it('exposes "module" property on created object', async done => {
    const moduleWatched = modulik('./resources/number-module');
    expect(moduleWatched).toHaveProperty('module');
    expect(moduleWatched.module).toEqual(expect.any(Promise));
    await moduleWatched.kill();
    done();
  });
  it('exposes "restart" method on created object', async done => {
    const moduleWatched = modulik('./resources/number-module');
    expect(moduleWatched).toHaveProperty('restart');
    expect(moduleWatched.restart).toEqual(expect.any(Function));
    await moduleWatched.kill();
    done();
  });
  it('exposes "kill" method on created object', async done => {
    const moduleWatched = modulik('./resources/number-module');
    expect(moduleWatched).toHaveProperty('kill');
    expect(moduleWatched.restart).toEqual(expect.any(Function));
    await moduleWatched.kill();
    done();
  });
  it('provides promise api for executing function-type module', async done => {
    const funcModulik = modulik('./resources/function-module');

    const func = await funcModulik.module;
    expect(func()).toEqual(expect.any(Promise));

    await funcModulik.kill();
    done();
  });
});
