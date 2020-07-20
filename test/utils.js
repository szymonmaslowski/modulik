const { writeFileSync, existsSync, readFileSync } = require('fs');
const chokidar = require('chokidar');
const rimraf = require('rimraf');

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
    if (existsSync(path) && readFileSync(path, 'utf-8') === content) {
      resolve();
      return;
    }
    const fsWatcher = chokidar.watch(path, { ignoreInitial: true });
    const finish = () => {
      process.nextTick(async () => {
        await fsWatcher.close();
        await wait(10);
        resolve();
      });
    };
    fsWatcher.on('add', finish).on('change', finish);
    await wait(10);
    writeFileSync(path, content);
  });

const deleteFileAndWait = path =>
  new Promise(async resolve => {
    if (!existsSync(path)) {
      resolve();
      return;
    }

    const fsWatcher = chokidar
      .watch(path, { ignoreInitial: true })
      .on('unlink', () => {
        process.nextTick(async () => {
          await fsWatcher.close();
          await wait(10);
          resolve();
        });
      });
    await wait(10);
    rimraf.sync(path);
  });

module.exports = {
  wait,
  spyOn,
  scheduler,
  writeFileAndWait,
  deleteFileAndWait,
};
