import ReactDOM from 'react-dom';
import renderApp from '../common/renderApp';

ReactDOM.hydrate(renderApp('Hello World'), document.querySelector('#root'));
