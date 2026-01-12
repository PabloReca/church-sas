import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import drizzle from "eslint-plugin-drizzle";

/** @type {import('eslint').Linter.Config[]} */
export default [
    { files: ["**/*.{js,mjs,cjs,ts}"] },
    { languageOptions: { globals: globals.browser, parserOptions: { project: "./tsconfig.json", tsconfigRootDir: import.meta.dirname } } },
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            drizzle,
        },
        rules: {
            "drizzle/enforce-delete-with-where": ["error", { drizzleObjectName: ["db"] }],
            "drizzle/enforce-update-with-where": ["error", { drizzleObjectName: ["db"] }],
        },
    },
    {
        ignores: ["dist/**", "node_modules/**"],
    },
];
