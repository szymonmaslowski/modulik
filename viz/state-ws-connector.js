const { WebSocketServer } = require('ws');

const createStateWSConnector = callbacks => {
  const server = new WebSocketServer({
    port: 4000,
  });

  let states = {
    isStarting: false,
    isAccessible: false,
    isKilled: false,
  };

  let client = null;
  server.on('connection', connection => {
    client = connection;
    connection.on('message', data => {
      const { type, name, args, statesData } = JSON.parse(data);

      if (type === 'states') {
        states = statesData;
        return;
      }

      const callback = callbacks[name];
      if (!callback) {
        throw new Error(`Invalid callback name ${name}`);
      }

      callback(...args);
    });
  });

  const baseApi = ['isStarting', 'isAccessible', 'isKilled'].reduce(
    (acc, name) => {
      acc[name] = () => states[name];
      return acc;
    },
    {},
  );

  return [
    'fSWatcherReady',
    'moduleChanged',
    'restartRequested',
    'ready',
    'execute',
    'processExited',
    'killRequested',
    'fSWatcherStopped',
  ].reduce((acc, name) => {
    acc[name] = (...args) => {
      client.send(
        JSON.stringify({
          type: 'command',
          name,
          args,
        }),
      );
    };
    return acc;
  }, baseApi);
};

module.exports = createStateWSConnector;
