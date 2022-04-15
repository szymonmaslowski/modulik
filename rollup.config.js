import pluginTypescript from '@rollup/plugin-typescript';
import glob from 'fast-glob';
import pluginDts from 'rollup-plugin-dts';

const external = [
  'child_process',
  'chokidar',
  'events',
  'path',
  'uuid',
  'xstate',
];

export default [
  {
    input: glob.sync('modulik/src/(child|modulik).ts'),
    output: {
      dir: `modulik/lib`,
      format: 'cjs',
      exports: 'auto',
      entryFileNames: '[name].js',
    },
    plugins: [pluginTypescript()],
    external,
  },
  {
    input: glob.sync('modulik/src/modulik.ts'),
    output: [{ file: 'modulik/lib/modulik.d.ts', format: 'es' }],
    plugins: [pluginDts()],
    external,
  },
];
