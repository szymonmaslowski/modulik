const { resolve } = require('path');
const { writeFileSync } = require('fs');

writeFileSync(resolve(__dirname, 'fs-artifact.txt'), 'content', 'utf-8');
