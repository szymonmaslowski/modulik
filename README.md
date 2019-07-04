# watch-module

Restart single module independently from the rest of your application.

Suppose you have a heavy server and it takes very long time to fully
start it, however you would like it to be restarted every change to
immediately see the result. Using watch-module you would be able to
restart just particular part of your server keeping rest of your server
up.

The real case example could be a node server that supports
Server Side Rendering and uses an webpack-dev-middleware. You are runnung
it via nodemon, so it restarts on any module change. As SSR
imports client module directly whole server app will restart
on any change to that client module. Server restart will cause webpack
to rebuild from scratch which takes time - more then just an update.

Exactly that case you can find in the [example](example).

## Installation

```bash
yarn add watch-module
```

## Simple example

There are two modules:

`greet.js`
```js
module.exports = name => `Hello ${name}!`;
```

`app.js`
```js
const watchModule = require('watch-module');
const greetWatched = watchModule('./greet.js');

setInterval(() => {
  greetWatched.module
    .then(greet => greet('John'))
    .then(greeting => {
      console.info(greeting);
    });
}, 1000);
```

On `greet.js` file change whole app keeps running, but only greet module
gets restarted. During the restart time module is not available, however
its invocations (`greet('John')`) are queued and once the module is back
they gets immediately executed.

For more sophisticated usage example check out the [example](example) project.

## Limitations

## API


