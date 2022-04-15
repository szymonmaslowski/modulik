import React from 'react';

function App({ children }) {
  return <h1>{children}</h1>;
}
const renderApp = text => <App>{text}</App>;

export default renderApp;
