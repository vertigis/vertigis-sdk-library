// @ts-check
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
"use strict";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";
import prettierConfig from "eslint-config-prettier/flat";
// @ts-expect-error: There are no typings avaliable for this plugin.
import { flatConfigs as importConfigs } from "eslint-plugin-import";
import reactPlugin from "eslint-plugin-react";
import { configs as reactHooksConfigs } from "eslint-plugin-react-hooks";
import globals from "globals";

// This "plugin" actually works by monkeypatching an eslint method.
import "eslint-plugin-only-warn";

// Versions of the 'globals' package prior to v13.12.1 have an extra space in a
// key that crashes eslint (https://github.com/sindresorhus/globals/pull/184).
// As Web itself (5.34) only demands v11.2 and SDK projects don't have an
// explicit dependency, the wrong package can sometimes end up being used.
const browserGlobals = Object.keys(globals.browser).reduce((acc, key) => {
    // @ts-expect-error: It's fine, the keys are all strings.
    acc[key.trim()] = globals.browser[key];
    return acc;
}, {});
const eslintGlobals = { ...globals, browser: browserGlobals };

/**
 * A default eslint configuration that can be extended.
 */
const baseConfig = defineConfig([
    globalIgnores(["node_modules/**/*"]),
    {
        name: "vertigis/recommended",
        languageOptions: {
            globals: {
                ...eslintGlobals.browser,
                ...eslintGlobals.commonjs,
                ...eslintGlobals.node,
            },
            ecmaVersion: 2022,
            sourceType: "module",
            parser: tseslint.parser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
                projectService: true,
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
