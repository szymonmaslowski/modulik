const fs = require('fs');
const path = require('path');

const logFilePath = path.resolve(__dirname, 'buffering-test-log.txt');
fs.appendFileSync(logFilePath, 'MODULE START\n');
// eslint-disable-next-line no-undef
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000);
fs.appendFileSync(logFilePath, 'MODULE STOP\n');
module.exports = () => {};
