import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { includeIgnoreFile } from "@eslint/compat";

import { fileURLToPath } from "node:url";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig([
  includeIgnoreFile(gitignorePath, "Imported .gitignore patterns"),
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    plugins: { js },
    extends: ["js/recommended", tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      eqeqeq: "error",
      "no-case-declarations": "off",
      "no-undef": "warn",
      "no-useless-escape": "warn",
    },
  },
]);
