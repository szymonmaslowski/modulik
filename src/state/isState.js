const isState = (state, ...names) =>
  names.some(name => state.toStrings().includes(name));

module.exports = isState;
