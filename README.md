# modulik

**modulik** allows to restart a module independently from the rest of your application.

## Description

Suppose you have a complex node application and it takes some time for it to
fully start. The development process of it starts to be pain in the arse, since
every change to the code makes you wasting time on waiting for whole app to start.
Using modulik you are able to restart just particular part of
your application keeping the rest up and running continuously.

> but there is nodemon..

The nodemon is awesome tool, but it doesn't solve some problems.
Read [modulik vs nodemon](#modulik-vs-nodemon) section.

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

**ModuleWrapper.module**

 - Returns: \<Promise\<module>>
 
If your module is of function type then you can invoke function exposed by
ModuleWrapper.module property in order to execute your module and access its
result.
 
>  You can access a function result **only via Promsie API** even if your module
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

to be written...

## modulik vs nodemon

You may think modulik is a clone of nodemon. Let me put you right..

Both modulik and nodemon are able to restart module on changes. Primary usage
of nodemon is the one via CLI, but you can use it also in runtime as importable
module. Modulik on the other hand focuses only on runtime usage.

The key advantage of modulik over nodemon is that it behaves like
the `require` statement. **It exposes what's being exported by given module.**
You can for instance have a module that exports a function. Import it using
modulik to enhance it with the "nodemon-ity" (restarting on changes).

Check out the [simple usage example](#simple-usage-example) or the
[example](example) project to see modulik in action!
