// ESLint flat config. Next's own rules (core web vitals) through the legacy
// adapter, plus unused and undeclared variables, which Next's preset leaves
// off. `npm run lint` shows warnings too; `npm test` runs it first and fails on
// errors only.

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "out/**", "build/**", "dist/**", ".agents/**", "tests/export_outputs/**", "public/**"] },
  // flat config only picks up .js/.mjs/.cjs by itself; without this every
  // component is skipped silently
  { files: ["**/*.{js,jsx,mjs,cjs}"] },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // a name used but never declared is a ReferenceError at runtime
      "no-undef": "error",
      // React escapes JSX text itself; this rule only flags apostrophes in prose
      "react/no-unescaped-entities": "off",
      // JSX counts as a use, so `import Foo` used only as <Foo /> is fine
      "react/jsx-uses-vars": "error",
      // unused imports and locals; arguments are often positional (useFrame's
      // (state, delta)), so only variables are checked. Prefix `_` to keep one.
      "no-unused-vars": [
        "error",
        { vars: "all", args: "none", caughtErrors: "none", ignoreRestSiblings: true, varsIgnorePattern: "^_" },
      ],
    },
  },
];

export default config;
