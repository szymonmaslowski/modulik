const createLogger = (moduleName: string, quiet: boolean) => {
  const makeMethod = (loggingFunction: (message: string) => void) => (
    message: string,
  ) => {
    if (quiet) return;
    loggingFunction(`[modulik]: ${moduleName} - ${message}`);
  };

  return {
    info: makeMethod(console.info),
    error: makeMethod(console.error),
  };
};

export default createLogger;
