import { renderToString } from 'react-dom/server';
import renderApp from '../common/renderApp';

export default ({ title }) => {
  const app = renderApp(title);
  const appMarkup = renderToString(app);
  return `\
<html lang="en">
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
