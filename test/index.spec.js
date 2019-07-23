const watchModule = require('..');

describe('module', () => {
  it('is of function type', () => {
    expect(watchModule).toEqual(expect.any(Function));
  });
  it('returns object', async done => {
    const moduleWatched = watchModule('./resources/number-module.js');
    expect(moduleWatched).toEqual(expect.any(Object));
    await moduleWatched.kill();
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
});

describe('"kill" property', () => {
  it('is a function', async done => {
    const moduleWatched = watchModule('./resources/number-module.js');
    expect(moduleWatched.kill).toEqual(expect.any(Function));
    await moduleWatched.kill();
    done();
  });
});
