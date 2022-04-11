# modulik

**modulik** allows to restart a module independently of the rest of your application.
In other words it gives the Hot Module Replacement (HMR) functionality for the node.js environment.

## Table of contents

 - [Description](#description)
 - [Installation](#installation)
 - [Simple usage example](#simple-usage-example)
 - [API](#api)
 - [Transpilation feature](#transpilation-feature)
 - [Limitations](#limitations)
 - [modulik vs nodemon](#modulik-vs-nodemon)

## Description

Suppose you have a complex node application, and it needs a lot of time to
fully start. The development process of it becomes painful, since every change made to
the source code makes you waisting time on waiting for the whole app to start.
Using modulik you are able to restart just particular part of
your application keeping the rest up and running continuously.

> but there is the nodemon..

Read the [modulik vs nodemon](#modulik-vs-nodemon) section to learn the difference.

Check out the [example](example) project to see **modulik** in action!
It shows real life example of how to modulik can enhance the development
experience of node server supporting SSR and serving assets of client app.

## Installation

```bash
yarn add modulik
```

## Simple usage example

There ia an application logging a greeting message to the console every one second.
It has two modules:

`greet.js`
```js
module.exports = name => `Hello ${name}!`;
```

`app.js`
```js
const modulik = require('modulik');
// import the greet module with modulik
const greetModulik = modulik('./greet');

(async () => {
  // access the current greet module
  const greet = await greetModulik.module;

  setInterval(async () => {
    // invoke the greet function (notice promise usage)
    const greeting = await greet('John');
    console.info(greeting);
    // -> Hello John!
  }, 1000);
})();
```

The app is started simply with the:
```bash
node app.js
```

With this setup every time you make a change to the `greet.js` file while the app is running
then the `greet.js` module gets restarted. During the restart time module is not available,
however its invocations (`greet('John')`) are queued and once the module is back available
those queued invocations gets immediately executed.

Now we can improve our app even more by introducing `nodemon` to restart
the whole application on changes to the `app.js` module. In order to do that we need
to change the start command to:
```bash
nodemon --watch app.js app.js
```
Notice the `--watch` parameter telling the `nodemon` to watch for changes of the `app.js` file.
The last `app.js` represents the entrypont of the app.

This way we achieve automatic application restarts on two levels:
 - restart of whole app on `app.js` file change
 - restart only of the `greet.js` module on changes to that module

Great job! 🎉

For more sophisticated usage example check out the [example](example) project.

## API

### modulik

**modulik\<ModuleType>(modulePath[, options])**<br />
**modulik\<ModuleType>(options)**

 - `ModuleType` (Only for usage in Typescript) a type of the entity exported by the module
 - `modulePath` *\<string>* Path to entry of the module. Specified file will be
 watched for changes
 - `options` *\<Object>*
    - `path` *\<string>* Path to entry of the module. Equal to `modulePath`
    argument. If both provided then `path` option overrides the `modulePath`
    - `watch` *\<Array>* Additional list of files or directories to be watched
    for changes
    - `watchExtensions` *\<Array>* List of non-standard extensions that will be
    considered during watching for changes to files specified in `watch` option.
    All standard node extensions are considered anyway, so you don't need to
    specify e.g. *js* extension
    - `disabled` *\<boolean>* Disables functionality of watching for changes and
    restarting, and just exposes the module. **Default:** `false`
    - `quiet` *\<boolean>* Disables logs. **Default:** `false`
    - `transpiler` *\<'babel'> | \<'typescript'>* Enables transpilation on the module. Note that this option requires additional dependencies. Check the [transpilation section](#Transpilation) for more information
    - `transpilerOptions` *\<Object>* Options used to setup the trnspilation. Check the [transpilation section](#Transpilation) for more information
 - Returns: <[ModuleWrapper](#ModuleWrapper)>

```js
modulik('./path/to/module', {
  watch: ['./path/to/directory', '/absolute/path', './path/to/specific-module.js'],
  watchExtensions: ['jsx'],
  disabled: PRODUCTION === true,
  quiet: true,
  transpiler: 'typescript',
  transpilerOptions: {}
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

`ModuleWrapper.module` property exposes an entity exported by your module, however **it will
be wrapped in a promise even if you didn't export a promise from your module**.

lucky-number.js
```js
export default 7;
```

app.js
```js
const myLuckyNumber = await luckyNumberModulik.module;
```

If your module exports a function, then the `ModuleWrapper.module` property will expose
a corresponding function too. It will be a representation of your function, so you can
execute it in order to execute your function and access its result.

>  You can access a function result **only via Promise API** even if your module
is not promise based

example-function.js
```js
export default (...args) => args.join(', ');
```

app.js
```js
const exampleFunction = await exampleFunctionModulik.module;
const result = await exampleFunction('some', 'arguments');
```

**ModuleWrapper.restart()**

 - Returns: \<Promise>

Programmatically restarts the wrapped module.
Returned promise is resolved only after the modules starts and is availbe to access.
In case module fails to start the promise will be rejected.

```js
await exampleModulik.restart();
console.info('My module is restarted and ready to be accessed');
```

**ModuleWrapper.kill()**

 - Returns: \<Promise>

Turns of the HMR functionality. Module will stop to restart on changes and keep the
latest body exposed from the `ModuleWrapper.module` property. In case the latest body
was a function all executions of that function will be rejected.

```js
await exampleModulik.kill();
try {
  const example = await exampleModulik.module;
  await example('some', 'arguments');
} catch(e) {
  console.info('I can access my module, but can not execute it, because it is already killed');
}
```

## Transpilation feature

> ⚠️ Note that if you already transpile your project using babel or typescript
> and run modulik in one of the files that are being transpiled then you don't need
> to setup the transpilation for modulik explicitly as it will just work seamlessly
> in your application environment

Modulik gives a possibility to enable transpilation for wrapped module
via setting the `transpiler` option to either `babel` or `typescript`.
It uses available tools designed for that:
 - [`@babel/register`](https://www.npmjs.com/package/@babel/register)
 - [`ts-node`](https://www.npmjs.com/package/ts-node)

The transpilation is achieved using the programmatic apis of those modules.
Both of them are an optional peer dependencies of modulik, so in order to use
the transpilation feature **you need to install adequate module and all of its
peer dependencies yourself**.

It is possible to provide transpilation options via `transpilerOptions` option.
The transpiler options you can provide depend on the transpilation tool you chose.
Please refer to the documentation of particular module for the complete list of options.

## Limitations

Modulik requires your module (exported entity) to be
 - serializable, or
 - a function which returns a serializable data

The serialization requirement is dictated by the nature of Node's IPC communication channel
which modulik uses. Node serializes data being send through IPC channel.

> But wait.. Function is not serializable..

It is not, but modulik treats it in a special way. Only result of execution has to be serializable
due to same "IPC channel" reason.

## modulik vs nodemon

> Hmm.. Is modulik another nodemon?

Both modulik and nodemon can restart your module on changes.
The key difference between modulik and nodemon is that modulik behaves like a `require`/`import` statement.
**It exposes the entity exported by a given module enhancing it with the ability of restarting on changes**
Given that you can access e.g. function exposed by your module and invoke it as it was imported via `require` or `import` statements.
Nodemon is missing the part of exposing module. It allows to restart a module on changes, but you cannot access the entity exported but that module.

Check out the [simple usage example](#simple-usage-example) or the
[example](example) project to see modulik in action!
