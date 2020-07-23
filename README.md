# modulik

**modulik** allows to restart a module independently of the rest of your application.

## Description

Suppose you have a complex node application, and it takes some time for it to
fully start. The development process of it starts to be pain in the arse, since
every change to the code makes you wasting time on waiting for a whole app to start.
Using modulik you are able to restart just particular part of
your application keeping the rest up and running continuously.

> but there is nodemon..

Read [modulik vs nodemon](#modulik-vs-nodemon) section to learn why modulik isn't another nodemon.

Check out the [example](example) project to see **modulik** in action!
It shows real life example of how to modulik can enhance the development
experience of node server supporting SSR and serving assets of client app.

## Installation

```bash
yarn add modulik
```

## Simple usage example

There are two modules:

`greet.js`
```js
module.exports = name => `Hello ${name}!`;
```

`app.js`
```js
const modulik = require('modulik');
const greetModulik = modulik('./greet');

setInterval(async () => {
  const greet = await greetModulik.module;
  const greeting = await greet('John');
  console.info(greeting);
  // -> Hello John!
}, 1000);
```

Even if you change `greet.js` file the app keeps running and only greet module
gets restarted. During the restart time module is not available, however
its invocations (`greet('John')`) are queued and once the module is back
they gets immediately executed.

For more sophisticated usage example check out the [example](example) project.

## API

### modulik

**modulik(modulePath[, options])**<br />
**modulik(options)**

 - `modulePath` *\<string>* Path to entry of the module. Specified file will be
 watched for changes
 - `options` *\<Object>*
    - `path` *\<string>* Path to entry of the module. Equal to `modulePath`
    argument. If both provided then `path` option overrides the `modulePath`
    - `watch` *\<Array>* Additional list of files or directories to be watched
    for changes
    - `extensions` *\<Array>* List of non-standard extensions that will be
    considered during watching for changes to files specified in `watch` option.
    All standard node extensions are considered anyway, so you don't need to
    specify e.g. *js* extension
    - `disabled` *\<boolean>* Disables functionality of watching for changes and
    restarting, and just exposes the module. **Default:** `false`
    - `quiet` *\<boolean>* Disables logs. **Default:** `false`
 - Returns: <[ModuleWrapper](#ModuleWrapper)>

```js
modulik('./path/to/module', {
  watch: ['./path/to/directory', '/absolute/path', './path/to/specific-module.js'],
  extensions: ['jsx'],
  disabled: PRODUCTION === true,
  quiet: true,
});
```
 
### ModuleWrapper

 - Extends <[EventEmitter](https://nodejs.org/api/events.html)>

**Event: 'restart'**

Emitted when restarting of module has begun.

**Event: 'ready'**

Emitted when module has been parsed and is ready to access.

**Event: 'failed'**

Emitted on unexpected failure of the module.

**ModuleWrapper.module**

 - Returns: \<Promise\<module>>
 
If your module is of function type then you can invoke function exposed by
ModuleWrapper.module property in order to execute your module and access its
result.
 
>  You can access a function result **only via Promise API** even if your module
is not promise based
 
```js
const example = await exampleModulik.module;
const result = await example('some', 'arguments');
```

**ModuleWrapper.restart()**

 - Returns: \<Promise>
 
```js
await exampleModulik.restart();
console.info('My module is ready to be accessed');
```

**ModuleWrapper.kill()**

 - Returns: \<Promise>
 
```js
await exampleModulik.kill();
try {
  const example = await exampleModulik.module;
  await example('some', 'arguments');
} catch(e) {
  console.info('I can access my module, but can not execute it, because it is already killed');
}
```

## Limitations

Modulik requires your module (entity exported using `module.exports`) to be
 - serializable, or
 - a function which returns a serializable data

The serialization requirement is dictated by the nature of Node's IPC communication channel
which modulik uses. Node serializes data being send through IPC channel.

> But wait.. Function is not serializable..

It is not, but modulik treats it in a special way. Only result of execution has to be serializable
due to same "IPC channel" reason.

## modulik vs nodemon

Both modulik and nodemon can restart your module on changes.
The key difference between modulik and nodemon is that modulik behaves like a `require` statement. **It exposes what's exported by given module and enhances it with the "nodemon-ity (restarting on changes)"**
Given that you can access entity exposed by your module and if it is a function you can invoke it via dedicated API.
Nodemon is missing the part of exposing module. It allows only to restart a module on changes, or programmatically.

Check out the [simple usage example](#simple-usage-example) or the
[example](example) project to see modulik in action!
