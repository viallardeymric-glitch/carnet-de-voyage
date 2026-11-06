// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Textes en français : les apostrophes sont normales dans <Text>.
      'react/no-unescaped-entities': 'off',
      // Chargements asynchrones au montage des écrans : choix assumé.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
]);
