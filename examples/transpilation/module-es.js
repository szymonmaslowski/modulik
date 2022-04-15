import modulik from 'modulik';

const nestedModulik = modulik('./nested-module-ts', {
  transpiler: 'typescript',
});

export default () => nestedModulik.module;
