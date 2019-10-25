const { writeFileSync } = require('fs');
const chokidar = require('chokidar');

const wait = ms =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

const spyOn = (obj, prop) => {
  const originalPropValue = obj[prop];
  const calls = [];
  // eslint-disable-next-line no-param-reassign
  obj[prop] = (...args) => {
    calls.push(args);
    return originalPropValue(...args);
  };
  return {
    free: () => {
      // eslint-disable-next-line no-param-reassign
      obj[prop] = originalPropValue;
    },
    get calls() {
      return [...calls];
    },
  };
};

const schedulerQueue = [];
const scheduler = {
  add(action) {
    schedulerQueue.push(action);
  },
  async run() {
    await schedulerQueue.reduce(
      (acc, action) => acc.then(() => action()),
      Promise.resolve(),
    );
    schedulerQueue.length = 0;
  },
};

const writeFileAndWait = (path, content) =>
  new Promise(async resolve => {
    const fsWatcher = chokidar
      .watch(path, { ignoreInitial: true })
      .on('all', () => {
        process.nextTick(() => {
          fsWatcher.close();
          resolve();
        });
      });
    await wait(10);
    writeFileSync(path, content);
  });

module.exports = {
  wait,
  spyOn,
  scheduler,
  writeFileAndWait,
};
