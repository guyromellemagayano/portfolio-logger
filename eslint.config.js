import globals from "globals";

import { baseEslintConfig } from "@portfolio/config-eslint";

/** @type {import("eslint").Linter.Config} */
export default [
  ...baseEslintConfig,
  {
    files: ["src/**/*.{js,cjs,mjs,ts,cts,mts,tsx,jsx}"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.{js,ts}", "**/*.{test,spec}.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
