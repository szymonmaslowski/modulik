const { resolve } = require('path');
const express = require('express');
const webpack = require('webpack');
const webpackDevMiddleware = require('webpack-dev-middleware');
const watchModule = require('../../');
const webpackConfig = require('../webpack.config');

const ssrWatched = watchModule('./ssr.js', {
  watch: ['./App.jsx'],
  disable: process.env.NODE_ENV === 'production',
});

const port = process.argv[2];

const app = express();
const compiler = webpack(webpackConfig);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(resolve('client')));
} else {
  app.use(webpackDevMiddleware(compiler, { stats: 'minimal' }));
}
app.use(/^\/$/, async (req, res) => {
  const ssr = await ssrWatched.module;
  const response = await ssr({ title: 'Hello World' });
  res.send(response);
});

app.listen(port, () => console.info(`Listening on port ${port}`));
