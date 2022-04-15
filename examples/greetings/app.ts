import modulik from 'modulik';
// Import just a type of exported greet function
import type { Greet } from './greet';
// import the greet module with modulik
const greetModulik = modulik<Greet>('./greet');

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
