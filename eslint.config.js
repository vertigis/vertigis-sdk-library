import { defineConfig } from "eslint/config";

import baseConfig from "./config/eslint.base.config.js";

export default defineConfig([
    baseConfig,
    {
        languageOptions: {
            parserOptions: {
                projectService: ["config/webpack.base.config.d.ts"],
            },
        },
        rules: {
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "import/default": "off",
            "import/no-named-as-default": "off",
            "import/no-named-as-default-member": "off",
        },
    },
]);
