// @ts-check
"use strict";

import chalk from "chalk";
import Webpack from "webpack";

const { supportsColor } = chalk;
const { webpack } = Webpack;

/**
 * SDK project build script.
 *
 * @param {import("webpack").Configuration} webpackConfig
 * @param {"web" | "workflow"} projectType
 *
 * @returns {Promise<void>}
 */
const build = async (webpackConfig, projectType) => {
    console.log("Creating an optimized production build...\n");

    const compiler = webpack(webpackConfig);

    return new Promise((resolve, reject) => {
        compiler.run((err, stats) => {
            if (err) {
                return reject(err);
            }

            console.log(
                stats?.toString({
                    preset: "normal",
                    colors: supportsColor ? supportsColor.hasBasic : false,
                })
            );

            if (stats?.hasErrors()) {
                return reject(new Error("SDK build cancelled with errors."));
            }

            if (
                process.env.CI &&
                (typeof process.env.CI !== "string" || process.env.CI.toLowerCase() !== "false") &&
                stats?.hasWarnings()
            ) {
                console.log(
                    chalk.yellow(
                        "\nTreating warnings as errors because process.env.CI = true.\n" +
                            "Most CI servers set it automatically.\n"
                    )
                );
                return reject(new Error("SDK build cancelled with warnings."));
            }

            if (stats?.hasWarnings()) {
                console.log(chalk.yellow("\nCompiled with warnings.\n"));
            } else {
                console.log(chalk.green("\nCompiled successfully.\n"));
                console.log(
                    `Your production build was created inside the ${chalk.cyan("build")} folder.`
                );
                console.log(
                    `You can learn more about deploying your custom code at ${chalk.cyan(
                        `https://developers.vertigisstudio.com/docs/${projectType}/overview/`
                    )}`
                );
            }

            resolve();
        });
    });
};

export default build;
