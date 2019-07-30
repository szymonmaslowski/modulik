const { resolve } = require('path');
const { writeFileSync } = require('fs');

writeFileSync(resolve(__dirname, 'fs-module.txt'), 'content', 'utf-8');
