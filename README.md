# watch-module

**watch-module** allows to restart single module independently from the rest of your application.

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
instead of just to apply a change.
1. even if you change only client-app related file you still need to
restart the server in order to consume new changes for SSR which leads
to problem 1.

**Solution:** use watch-module to 1) import SSR module, 2) specify App
component to be watched for changes and 3) exclude SSR and App files from
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

setInterval(async () => {
  const greet = await greetWatched.module;
  const greeting = await greet('John');
  console.info(greeting);
  // -> Hello John!
}, 1000);
```

Every time `greet.js` file changes the app keeps running and only greet module
gets restarted. During the restart time module is not available, however
its invocations (`greet('John')`) are queued and once the module is back
they gets immediately executed.

For more sophisticated usage example check out the [example](example) project.

## API

### watch-module

**watch-module(modulePath[, options])**<br />
**watch-module(options)**

 - `modulePath` *\<string>* Path to entry of the module. Specified file will be
 watched for changes 
 - `options` *\<Object>*
    - `path` *\<string>* Path to entry of the module. Equal to `modulePath`
    argument. If both provided then `path` option overrides the `modulePath`
    - `watch` *\<Array>* Additional list of files or directories to be watched
    for changes
    - `disable` *\<boolean>* Disables functionality of watching for changes and
    restarting, and just exposes the module. **Default:** `false`
    - `quiet` *\<boolean>* Disables logs. **Default:** `false`
 - Returns: <[ModuleWrapper](#ModuleWrapper)>

```js
watchModule('./path/to/module', {
  watch: ['./path/to/related-module1', './path/to/related-module2'],
  disable: PRODUCTION === true,
  quiet: true,
});
```
 
### ModuleWrapper

**ModuleWrapper.module**

 - Returns: \<Promise\<module>>
 
If your module is of function type then you can invoke function exposed by
ModuleWrapper.module property in order to execute your module and access its
result.
 
>  You can access a function result **only via Promsie API** even if your module
is not promise based
 
```js
const myModule = await myModuleWatched.module;
const result = await myModule('some', 'arguments');
```

**ModuleWrapper.restart()**

 - Returns: \<Promise>
 
```js
await myModuleWatched.restart();
console.info('My module is ready to be accessed');
```

**ModuleWrapper.kill()**

 - Returns: \<Promise>
 
```js
await myModuleWatched.kill();
try {
  await myModuleWatched.module;
} catch(e) {
  console.info('I can not access my module, because it is already killed');
}
```

## Limitations
