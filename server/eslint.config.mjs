import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "data", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,js}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      sourceType: "module",
    },
    plugins: {
      "import-x": importPlugin,
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      // Practical correctness
      eqeqeq: ["error", "always"],
      "no-debugger": "error",
      // ESLint 10 additions need a dedicated cleanup pass before becoming blocking.
      "no-useless-assignment": "off",
      "preserve-caught-error": "off",

      // Keep server lint non-blocking for now (repo has existing console usage)
      "no-console": "off",

      // Transitional: repo still has legacy ts-comments
      "@typescript-eslint/ban-ts-comment": "warn",

      // Imports hygiene
      "import-x/no-duplicates": "warn",
      "import-x/newline-after-import": "warn",
      "import-x/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
            "object",
            "type",
          ],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],

      // TS defaults tweaks (align with repo reality)
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
