# Inspecor

Runs modulik with XState inspector plugged in. The state module is moved to the browser and it talks with the modulik via websocket connection. 

## Setup
1. In the [launchFully.js]() file change the path of the local state module to the [./state-ws-connector.js](./lib/state-ws-connector.js) file,
2. In the [index.js]() file:
   1. Add `{ devTools: true }` as a second argument of the `interpret` function,
   2. Change the [process.nextTick]() function with the `queueMicrotask` function,

## Run

Put your code in the [./main.js]() and [./child.js]() files and run `yarn start` in this (inspect) directory.

## Notes

The websocket server is running on the 4444 port so make sure it is free.
