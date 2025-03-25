
// @ts-check
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
"use strict";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettierConfig from "eslint-config-prettier";
// @ts-expect-error: There are no typings avaliable for this plugin.
import { flatConfigs as importConfigs } from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import { configs as reactHooksConfigs } from "eslint-plugin-react-hooks";
import globals from "globals";

// This "plugin" actually works by monkeypatching an eslint method.
import "eslint-plugin-only-warn";

/**
 * A default eslint configuration that can be extended.
 */
const baseConfig = defineConfig([
    globalIgnores(["node_modules/**/*"]),
    {
        name: "vertigis/recommended",
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            ecmaVersion: 2022,
            sourceType: "module",
            parser: tseslint.parser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
                projectService: true
            },
        },
        settings: {
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                    project: "./tsconfig.json",
                },
            },
            react: {
                version: "detect",
            },
        },
    },
    tseslint.config(eslint.configs.recommended, tseslint.configs.recommendedTypeChecked),
    reactPlugin.configs.flat.recommended,
    reactPlugin.configs.flat["jsx-runtime"],
    reactHooksConfigs["recommended-latest"],
    importConfigs.recommended,
    importConfigs.typescript,
    prettierConfig,
]);

export default baseConfig;