const { resolve } = require('path');

const commonDir = resolve(__dirname, 'src/common');
const srcDir = resolve(__dirname, 'src/client');
const outDir = resolve(__dirname, 'dist/static');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: resolve(srcDir, 'index.jsx'),
  output: {
    filename: 'client.js',
    path: outDir,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/i,
        use: 'babel-loader',
        include: [commonDir, srcDir],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};
