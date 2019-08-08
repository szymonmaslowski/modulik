# watch-module

**watch-module** allow to restart single module independently from the rest of your application.

Suppose you have a heavy server. You would like it to be restarted every change
in order to see the result immediately, but it takes very long time to fully
start it. Using watch-module you are able to restart just particular part of
your server keeping the rest up and running continuously.

**Example:** there is a node server that supports
Server Side Rendering and uses webpack-dev-middleware. It starts
via nodemon, so any change to the code restarts whole server.

**Problems:**
1. every restart of server causes webpack-dev-middleware
to recompile from scratch whole client-app (which could be time consuming)
instead to just apply a change.
1. even if you change only client-app related file you still need to
restart the server in order to consume new changes for SSR which leads
to problem 1.

**Solution:** use watch-module to 1) import SSR module and 2) specify App
component to be watched for changes. Additionally 3) exclude SSR and App files from
nodemon watching.

**Result:**
1. changes to SSR module don't restart whole server but only SSR module itself.
1. changes to App component cause webpack-dev-middleware to just update
client-app's assets because whole server was not restarted but rather only the
SSR module.

The above case you can find in the [example](example) project.

## Installation

```bash
yarn add watch-module
```

## Simple usage example

There are two modules:

`greet.js`
```js
module.exports = name => `Hello ${name}!`;
```

`app.js`
```js
const watchModule = require('watch-module');
const greetWatched = watchModule('./greet');

setInterval(() => {
  greetWatched.module
    .then(greet => greet('John'))
    .then(greeting => {
      console.info(greeting);
    });
}, 1000);
```

Every `greet.js` file change app keeps running, but only greet module
gets restarted. During the restart time module is not available, however
its invocations (`greet('John')`) are queued and once the module is back
they gets immediately executed.

For more sophisticated usage example check out the [example](example) project.

## Limitations

## API


