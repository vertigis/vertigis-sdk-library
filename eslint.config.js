import { defineConfig } from "eslint/config";

import baseConfig from "./config/eslint.base.config.js";

export default defineConfig([
    baseConfig,
    {
        languageOptions: {
            parserOptions: {
                projectService: ["config/webpack.base.config.d.ts"]
            }
        },
        rules: {
            "import/no-named-as-default": "off",
            "import/no-named-as-default-member": "off",
        },
    },
]);
