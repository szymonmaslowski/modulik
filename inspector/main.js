const modulik = require('../modulik');

const greetModulik = modulik('./child');

setInterval(async () => {
  const greet = await greetModulik.module;
  const greeting = await greet('John');
  console.info(greeting);
}, 1000);
