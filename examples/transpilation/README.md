## Transpilation

This simple application showcases the modulik's transpilation feature.
Take a look at the file nesting tree:
```
entry-cjs.js
├── module-ts.ts
└── module-es.js
    └── nested-module-ts.ts
```

1. The app starts from the `entry-cjs.js` file which is not transpiled and uses CommonJS.
2. The `entry-cjs.js` imports `module-ts.ts` with modulik using `typescript` transpilation
3. The `entry-cjs.js` imports `module-es.js` with modulik using `babel` transpilation
4. The `module-es.js` imports `nested-module-ts.ts` with modulik using `typescript` transpilation
