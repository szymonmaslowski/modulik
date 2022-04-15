module.exports = {
  plugins: ['prettier', 'react'],
  extends: ['airbnb', 'airbnb-typescript/base', 'prettier'],
  rules: {
    '@typescript-eslint/comma-dangle': 'off',
    '@typescript-eslint/indent': 'off',
    'global-require': 'off',
    'import/no-dynamic-require': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: ['rollup.config.js'],
      },
    ],
    'no-console': [
      'error',
      {
        allow: ['error', 'info'],
      },
    ],
    'prefer-object-spread': 'off',
    'prettier/prettier': 'error',
    'react/jsx-filename-extension': [
      'error',
      {
        extensions: ['.js', '.jsx'],
      },
    ],
  },
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
};
