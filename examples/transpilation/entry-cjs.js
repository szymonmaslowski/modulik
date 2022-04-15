const modulik = require('modulik');

const esModulik = modulik('./module-es', {
  transpiler: 'babel',
});
const tsModulik = modulik('./module-ts', {
  transpiler: 'typescript',
});

(async () => {
  const getEsObject = await esModulik.module;
  const tsObject = await tsModulik.module;

  const esObject = await getEsObject();

  console.info(
    'Objects equal:',
    JSON.stringify(esObject) === JSON.stringify(tsObject),
  );
})();
