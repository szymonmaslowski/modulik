const assert = require('assert');
const modulik = require('modulik');
const { scheduler } = require('../utils');

describe('Transpilation feature', () => {
  afterEach(async () => {
    await scheduler.run();
  });

  [
    {
      name: 'es',
      module: './resources/es-number-module',
      transpiler: 'babel',
    },
    {
      name: 'ts',
      module: './resources/ts-number-module',
      transpiler: 'typescript',
    },
  ].forEach(({ name, module, transpiler }) => {
    it(`transpiles ${name} module correctly`, async () => {
      const instance = modulik(module, {
        transpiler,
      });
      scheduler.add(async () => {
        await instance.kill();
      });

      await instance.module;
    });
  });

  [
    {
      name: 'es',
      module: './resources/es-mixed-export-module',
      transpiler: 'babel',
    },
    {
      name: 'ts',
      module: './resources/ts-mixed-export-module',
      transpiler: 'typescript',
    },
  ].forEach(({ name, module, transpiler }) => {
    it(`prioritizes default export of ${name} module`, async () => {
      const instance = modulik(module, {
        transpiler,
      });
      scheduler.add(async () => {
        await instance.kill();
      });
      const moduleBody = await instance.module;

      assert.deepStrictEqual(typeof moduleBody, 'function');
    });
  });

  [
    {
      name: 'es',
      module: './resources/es-named-export-module',
      transpiler: 'babel',
    },
    {
      name: 'ts',
      module: './resources/ts-named-export-module',
      transpiler: 'typescript',
    },
  ].forEach(({ name, module, transpiler }) => {
    it(`exposes object with all named exports of ${name} module if there is no default export in that module`, async () => {
      const instance = modulik(module, {
        transpiler,
      });
      scheduler.add(async () => {
        await instance.kill();
      });
      const moduleBody = await instance.module;

      assert.deepStrictEqual(moduleBody, {
        first: 1,
        second: 'second',
      });
    });
  });

  [
    {
      name: 'es',
      module: './resources/es-function-module',
      transpiler: 'babel',
      expectedResult: 'es-function-module.js',
    },
    {
      name: 'ts',
      module: './resources/ts-function-module',
      transpiler: 'typescript',
      expectedResult: 'ts-function-module.ts',
    },
  ].forEach(({ name, module, transpiler, expectedResult }) => {
    it(`allows to execute function exported by ${name} module`, async () => {
      const instance = modulik(module, {
        transpiler,
      });
      scheduler.add(async () => {
        await instance.kill();
      });

      const esModule = await instance.module;
      const result = await esModule();

      assert.deepStrictEqual(result, expectedResult);
    });
  });
});
