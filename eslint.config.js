import { defineConfig } from "eslint/config";
import jest from "eslint-plugin-jest";

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
    {
        files: ["**/*.test.js"],
        extends: [jest.configs["flat/all"]],
        rules: {
            // Disable rules that are lower value in tests
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/no-var-requires": "off",
            "@typescript-eslint/restrict-template-expressions": "off",
            "jest/no-duplicate-hooks": "warn",
            "jest/no-hooks": "off",
            "jest/prefer-ending-with-an-expect": "off",
            "jest/prefer-expect-assertions": ["warn", { onlyFunctionsWithExpectInLoop: true }],
            "jest/prefer-lowercase-title": ["warn", { ignore: ["describe"] }],
            "jest/prefer-spy-on": "warn",
            "jest/prefer-strict-equal": "warn",
            "jest/require-top-level-describe": "off",
            "jest/unbound-method": "off",
            "jest/valid-title": "warn",
            "no-await-in-loop": "off",
        },
    },
]);
