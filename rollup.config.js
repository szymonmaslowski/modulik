import pluginTypescript from '@rollup/plugin-typescript';
import glob from 'fast-glob';

export default {
  input: glob.sync('modulik/src/!(typings.d).ts'),
  output: [
    {
      dir: 'modulik/lib',
      format: 'cjs',
      exports: 'auto',
    },
  ],
  preserveModules: true,
  plugins: [pluginTypescript()],
  external: ['child_process', 'chokidar', 'events', 'path', 'uuid', 'xstate'],
};
