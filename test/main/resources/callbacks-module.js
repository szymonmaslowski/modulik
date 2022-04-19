module.exports = (cb1, [cb2, cb3], { cb4, cb5 }) =>
  Promise.all([cb1, cb2, cb3, cb4, cb5].map(cb => cb()));
