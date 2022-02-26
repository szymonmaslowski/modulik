import React from 'react';

const App = ({ children }) => <h1>{children}</h1>;
const renderApp = text => <App>{text}</App>;

export default renderApp;
