# Simple typescript greetings app

This is the same app as the one presented in the
[Simple usage example section](../../modulik/README.md#simple-usage-example) of the modulik's readme.
There is a small difference though - this app is built with typescript and thanks to that it
is able to instruct modulik what is the expected type of your module.

```ts
import type { Greet } from './greet';  // Greet is (name: string) => string;
const greetModulik = modulik<Greet>('./greet');

const greet = await greetModulik.module; // The greet is of type (name: string) => Promise<string>;
```

Notice the fact that the type of the `greet` module exposed by the modulik is different
than the `Greet` type.
The difference is in the return type which for the exposed `greet` module is wrapped in `Promise`

> If provided type is a function type and its return type is not a `Promise` then modulik
always wraps it with the `Promise`.
