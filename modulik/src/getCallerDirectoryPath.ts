import path from 'path';

export default () => {
  const rawStack = new Error().stack;
  if (!rawStack) {
    throw new Error('Could not detect requested module directory');
  }

  const lineWithCallerPath = rawStack.split('\n')[3];
  const matchedCallSource = lineWithCallerPath.match(
    /^\s*at\s[^(]*\(([^)]*)\)$/,
  );
  const exactLocationOfTheCallInTheCallerFile = matchedCallSource
    ? matchedCallSource[1]
    : lineWithCallerPath.split('at ')[1];
  const callerFilePath = exactLocationOfTheCallInTheCallerFile.split(':')[0];
  return path.dirname(callerFilePath);
};
