const { resolve } = require('path');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

if (process.env.NODE_ENV !== 'production') {
  require('@babel/register')({ extends: resolve(__dirname, '../.babelrc') });
}

const App = require('./App').default;

module.exports = ({ title }) => {
  const app = React.createElement(App);
  const appMarkup = ReactDOMServer.renderToString(app);
  return `\
<html>
<head>
  <title>${title}</title>
</head>
<body>
  <div id="root">${appMarkup}</div>
  <script src="client.js"></script>
</body>
</html>
`;
};
