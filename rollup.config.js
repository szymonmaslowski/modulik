import pluginTypescript from '@rollup/plugin-typescript';
import glob from 'fast-glob';
import pluginCopy from 'rollup-plugin-copy';

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
  plugins: [
    pluginTypescript(),
    pluginCopy({
      targets: [{ src: 'modulik/src/child.js', dest: 'modulik/lib' }],
    }),
  ],
  external: ['child_process', 'chokidar', 'events', 'path', 'uuid', 'xstate'],
};
