const { resolve } = require('path');

const srcDir = resolve(__dirname, 'src');
const outDir = resolve(__dirname, 'dist/static');

module.exports = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: resolve(srcDir, 'client.jsx'),
  output: {
    filename: 'client.js',
    path: outDir,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/i,
        use: 'babel-loader',
        include: [srcDir],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
};
