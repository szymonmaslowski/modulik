const { resolve } = require('path');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const rimraf = require('rimraf');
const watchModule = require('..');

const wait = ms =>
  new Promise(resolvePromise => {
    setTimeout(resolvePromise, ms);
  });

describe('module', () => {
  it('is of function type', () => {
    expect(watchModule).toEqual(expect.any(Function));
  });
  it('executes with minimal params with no problems', async done => {
    const moduleWatched1 = watchModule('./resources/number-module.js');
    const moduleWatched2 = watchModule({
      path: './resources/number-module.js',
    });

    expect(moduleWatched1).toBeTruthy();
    expect(moduleWatched2).toBeTruthy();

    await moduleWatched1.kill();
    await moduleWatched2.kill();
    done();
  });
  it('allows for absolute path to module', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = resolve(__dirname, 'resources/fs-module.js');

    const moduleWatched1 = watchModule(modulePath);
    await moduleWatched1.module;
    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    const moduleWatched2 = watchModule({ path: modulePath });
    await moduleWatched2.module;
    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    await moduleWatched1.kill();
    await moduleWatched2.kill();
    done();
  });
  it('restarts module under provided path on changes to the file', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = resolve(__dirname, 'resources/fs-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');

    const moduleWatched = watchModule(modulePath);
    await moduleWatched.module;
    rimraf.sync(filePath);
    writeFileSync(modulePath, `${moduleContent}\n`);
    await wait(1000);
    await moduleWatched.module;

    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    await moduleWatched.kill();
    writeFileSync(modulePath, moduleContent);
    done();
  });
  it('creates object', async done => {
    const moduleWatched = watchModule('./resources/number-module.js');
    expect(moduleWatched).toEqual(expect.any(Object));
    await moduleWatched.kill();
    done();
  });
  it('disables logging when quiet property of config is set to true', async done => {
    const spy = jest.spyOn(console, 'info');
    const moduleWatched1 = watchModule('./resources/number-module.js', {
      quiet: true,
    });
    const moduleWatched2 = watchModule({
      path: './resources/number-module.js',
      quiet: true,
    });

    expect(spy).toHaveBeenCalledTimes(0);

    await moduleWatched1.kill();
    await moduleWatched2.kill();
    spy.mockRestore();
    done();
  });
  it('disables functionality of watching and restarting when disable property of config is set to true', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = resolve(__dirname, 'resources/fs-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');

    const moduleWatched1 = watchModule(modulePath, { disable: true });
    await moduleWatched1.module;
    rimraf.sync(filePath);
    writeFileSync(modulePath, `${moduleContent}\n`);
    await wait(1000);
    await moduleWatched1.module;

    expect(existsSync(filePath)).toBeFalsy();

    const moduleWatched2 = watchModule({ path: modulePath, disable: true });
    await moduleWatched2.module;
    rimraf.sync(filePath);
    writeFileSync(modulePath, moduleContent);
    await moduleWatched1.module;

    expect(existsSync(filePath)).toBeFalsy();

    await moduleWatched1.kill();
    await moduleWatched2.kill();
    done();
  });
});

describe('returned object', () => {
  it('has "module" property', async done => {
    const moduleWatched = watchModule('./resources/number-module.js');
    expect(moduleWatched).toHaveProperty('module');
    await moduleWatched.kill();
    done();
  });
  it('has "restart" method', async done => {
    const moduleWatched = watchModule('./resources/number-module.js');
    expect(moduleWatched).toHaveProperty('restart');
    await moduleWatched.kill();
    done();
  });
  it('has "kill" method', async done => {
    const moduleWatched = watchModule('./resources/number-module.js');
    expect(moduleWatched).toHaveProperty('kill');
    await moduleWatched.kill();
    done();
  });
});

describe('"module" property', () => {
  it('is a promise', async done => {
    const moduleWatched = watchModule('./resources/number-module.js');
    expect(moduleWatched.module).toEqual(expect.any(Promise));
    await moduleWatched.kill();
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
    it(`exposes ${typeName} when module exports ${typeName}`, async done => {
      const moduleWatched = watchModule(`./resources/${fileName}`);
      const exposedModule = await moduleWatched.module;
      expect(typeof exposedModule).toEqual(matcher.type);
      expect(exposedModule).toEqual(matcher.value);
      await moduleWatched.kill();
      done();
    });
  });
  it('exposes object when module does not export anything', async done => {
    const moduleWatched = watchModule('./resources/empty-module.js');
    const exposedModule = await moduleWatched.module;
    expect(typeof exposedModule).toEqual('object');
    expect(exposedModule).toEqual(expect.any(Object));
    await moduleWatched.kill();
    done();
  });
});

describe('"restart" property', () => {
  it('is a function', async done => {
    const moduleWatched = watchModule('./resources/number-module.js');
    expect(moduleWatched.restart).toEqual(expect.any(Function));
    await moduleWatched.kill();
    done();
  });
  it('restarts watched module', async done => {
    const filePath = resolve(__dirname, 'resources/fs-module.txt');

    rimraf.sync(filePath);
    const moduleWatched = watchModule('./resources/fs-module.js');
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
});

describe('"kill" property', () => {
  it('is a function', async done => {
    const moduleWatched = watchModule('./resources/number-module.js');
    expect(moduleWatched.kill).toEqual(expect.any(Function));
    await moduleWatched.kill();
    done();
  });
});
