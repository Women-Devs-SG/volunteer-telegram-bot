// eslint.config.js
import globals from "globals";
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-console": "warn", // Warns you if you leave console.log statements
      "no-unused-vars": "warn", // Warns about variables that are declared but not used
      eqeqeq: "error", // Enforces using === and !== instead of == and !=
      "no-undef": "error", // Disallows the use of undeclared variables
    },
  },
];
