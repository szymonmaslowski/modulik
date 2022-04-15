const WebSocket = require('ws');

const createStateWSConnector = callbacks => {
  const server = new WebSocket.Server({
    port: 4444,
  });

  let client = null;
  server.on('connection', connection => {
    client = connection;
    connection.on('message', data => {
      const { name, args } = JSON.parse(data);

      const callback = callbacks[name];
      if (!callback) {
        throw new Error(`Invalid callback name ${name}`);
      }

      callback(...args);
    });
  });

  return [
    'execute',
    'fSWatcherReady',
    'fSWatcherStopped',
    'killRequested',
    'moduleChanged',
    'processExited',
    'ready',
    'restartRequested',
  ].reduce((acc, name) => {
    acc[name] = (...args) => {
      client.send(
        JSON.stringify({
          name,
          args,
        }),
      );
    };
    return acc;
  }, {});
};

module.exports = createStateWSConnector;
