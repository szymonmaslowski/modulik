const path = require('path');
const {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} = require('fs');
const chokidar = require('chokidar');
const rimraf = require('rimraf');
const modulik = require('..');

const wait = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

describe('the module', () => {
  it('executes with minimal params with no problems', async done => {
    const moduleWatched1 = modulik('./resources/number-module');
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
    const moduleWatched = modulik('./resources/empty-module');
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
    const filePath = path.resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = path.resolve(__dirname, 'resources/fs-module.js');
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
    const filePath = path.resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = path.resolve(__dirname, 'resources/fs-module.js');
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
    const filePath = path.resolve(__dirname, 'resources/fs-module.txt');
    const module1Path = './resources/empty-module.js';
    const module2Path = path.resolve(__dirname, 'resources/function-module.js');
    const module1Content = readFileSync(
      path.resolve(__dirname, module1Path),
      'utf-8',
    );
    const module2Content = readFileSync(module2Path, 'utf-8');

    const moduleWatched = modulik('./resources/fs-module.js', {
      watch: [module1Path, module2Path],
    });
    await moduleWatched.module;
    rimraf.sync(filePath);
    writeFileSync(path.resolve(__dirname, module1Path), `${module1Content}\n`);
    await wait(1000);

    expect(existsSync(filePath)).toBeTruthy();

    rimraf.sync(filePath);
    writeFileSync(module2Path, `${module2Content}\n`);
    await wait(1000);

    expect(existsSync(filePath)).toBeTruthy();

    await moduleWatched.kill();
    writeFileSync(path.resolve(__dirname, module1Path), module1Content);
    writeFileSync(module2Path, module2Content);
    done();
  });
  it('restarts module when "restart" method was invoked', async done => {
    const filePath = path.resolve(__dirname, 'resources/fs-module.txt');

    rimraf.sync(filePath);
    const moduleWatched = modulik('./resources/fs-module');
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
    const moduleWatched = modulik('./resources/number-module');
    await moduleWatched.kill();
    await moduleWatched.kill();
    done();
  });
  it('allows to access killed module', async done => {
    const moduleWatched = modulik('./resources/number-module');
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
    const moduleWatched = modulik('./resources/function-module');
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
    const filePath = path.resolve(__dirname, 'resources/fs-module.txt');
    const modulePath = path.resolve(__dirname, 'resources/fs-module.js');
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
  it('allows to use same module representation function instance after module change', async done => {
    const modulePath = path.resolve(__dirname, 'resources/function-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');

    const functionModulik = modulik(modulePath);
    const func = await functionModulik.module;

    let proceedWithExecution = null;
    const fsWatcher = chokidar
      .watch(modulePath, { ignoreInitial: true })
      .on('all', () => proceedWithExecution());

    const waitingForFileChangePromise = new Promise(resolve => {
      proceedWithExecution = resolve;
    });
    writeFileSync(
      modulePath,
      // eslint-disable-next-line no-template-curly-in-string
      'module.exports = arg => `The arg: ${arg}.`;',
    );
    await waitingForFileChangePromise;
    await functionModulik.module;

    const results = await Promise.all([func(1), func('argument')]);
    expect(results[0]).toEqual('The arg: 1.');
    expect(results[1]).toEqual('The arg: argument.');

    await functionModulik.kill();
    fsWatcher.close();
    writeFileSync(modulePath, moduleContent);
    done();
  });
  it('throws an error when trying to execute a module which is not a function anymore', async done => {
    const modulePath = path.resolve(__dirname, 'resources/function-module.js');
    const moduleContent = readFileSync(modulePath, 'utf-8');

    const functionModulik = modulik(modulePath);
    const func = await functionModulik.module;

    let proceedWithExecution = null;
    const fsWatcher = chokidar
      .watch(modulePath, { ignoreInitial: true })
      .on('all', () => proceedWithExecution());

    const waitingForFileChangePromise = new Promise(resolve => {
      proceedWithExecution = resolve;
    });
    writeFileSync(modulePath, 'module.exports = 1;');
    await waitingForFileChangePromise;
    await functionModulik.module;

    try {
      await func();
      done(new Error('Module did not throw'));
    } catch (e) {
      expect(e.message).toEqual('Cannot execute module of number type');
    }

    await functionModulik.kill();
    fsWatcher.close();
    writeFileSync(modulePath, moduleContent);
    done();
  });
  it('buffers all execution attempts during module unavailability and executes them once module is ready', async done => {
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
    writeFileSync(logFilePath, '');

    let proceedWithExecution = null;
    const fsWatcher = chokidar
      .watch(modulePath, { ignoreInitial: true })
      .on('all', () => proceedWithExecution());

    const waitingForFileChangePromise = new Promise(resolve => {
      proceedWithExecution = resolve;
    });
    writeFileSync(modulePath, `${moduleContent}\n`);
    await waitingForFileChangePromise;

    await wait(1000);
    const moduleExecutionPromise = func();
    appendFileSync(logFilePath, 'EXECUTION\n');
    await moduleExecutionPromise;

    expect(readFileSync(logFilePath, 'utf-8')).toEqual(
      'MODULE START\nEXECUTION\nMODULE STOP\n',
    );

    await functionModulik.kill();
    fsWatcher.close();
    writeFileSync(modulePath, moduleContent);
    writeFileSync(logFilePath, '');
    done();
  });
  it('forgets buffered executions if after file change module is no longer a function', async done => {
    const modulePath = path.resolve(
      __dirname,
      'resources/long-evaluable-number-module.js',
    );
    const moduleContent = readFileSync(modulePath, 'utf-8');

    writeFileSync(modulePath, 'module.exports = () => {};');
    const functionModulik = modulik(modulePath);
    const func = await functionModulik.module;

    let proceedWithExecution = null;
    const fsWatcher = chokidar
      .watch(modulePath, { ignoreInitial: true })
      .on('all', () => proceedWithExecution());

    const waitingForFileChangePromise = new Promise(resolve => {
      proceedWithExecution = resolve;
    });
    writeFileSync(modulePath, moduleContent);
    await waitingForFileChangePromise;

    await wait(1000);

    try {
      await func();
      done(new Error('Module did not throw'));
    } catch (e) {
      expect(e.message).toEqual('Module is not a function. Cannot execute.');
    }

    await functionModulik.kill();
    fsWatcher.close();
    done();
  });
});
