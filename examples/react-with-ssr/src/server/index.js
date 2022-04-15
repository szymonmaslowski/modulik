import express from 'express';
import modulik from 'modulik';
import { resolve } from 'path';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';

const production = process.env.NODE_ENV === 'production';
const port = process.argv[2];
const app = express();

const ssrModulik = modulik('./ssr', {
  watch: ['../common'],
  disabled: production,
  quiet: production,
});

let servingClientMiddleware = express.static(resolve(__dirname, '../static'));
if (!production) {
  const webpackConfig = require('../../webpack.config');
  const compiler = webpack(webpackConfig);
  servingClientMiddleware = webpackDevMiddleware(compiler, {
    stats: 'minimal',
  });
}
app.use(servingClientMiddleware);

app.use(/^\/(index.html)?$/, async (req, res) => {
  try {
    const ssr = await ssrModulik.module;
    const response = await ssr({ title: 'Hello World' });
    res.send(response);
  } catch (e) {
    console.error(e);
    res.sendStatus(500);
  }
});

app.listen(port, () => console.info(`Listening on port ${port}`));
