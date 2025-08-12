// @ts-check
"use strict";

import chalk from "chalk";
import crypto from "crypto";
import fs from "fs"
import fsExtra from "fs-extra/esm";
import path from "path";
import spawn from "cross-spawn";

const { copySync, moveSync } = fsExtra;

/**
 * SDK project creation script.
 *
 * @param {string} sourceDir
 * @param {string} targetName
 * @param {"web" | "workflow"} projectType
 */
const create = (sourceDir, targetName, projectType) => {
    const targetPath = path.resolve(targetName);

    /**
     * @param {import("child_process").SpawnSyncReturns<Buffer>} syncResult
     */
    const checkSpawnSyncResult = syncResult => {
        if (syncResult.status !== 0) {
            process.exit(1);
        }
    };

    /**
     * @param {string} projectPath
     */
    const checkDirectoryPath = projectPath => {
        if (!/^[\w-]+$/.test(path.basename(projectPath))) {
            console.error(
                chalk.red(
                    `Cannot create new project at ${chalk.green(
                        projectPath
                    )} as the directory name is not valid. Letters, numbers, dashes and underscores are allowed.\n`
                )
            );
            process.exit(1);
        }

        // Exclamation points are not permitted in the path as it's reserved for
        // webpack loader syntax.
        if (/[!]/.test(projectPath)) {
            console.error(
                chalk.red(
                    `Cannot create new project at ${chalk.green(
                        projectPath
                    )} as the path is not valid. Exclamation points (!) are not allowed in the file system path.\n`
                )
            );
            process.exit(1);
        }

        if (fs.existsSync(projectPath) && fs.readdirSync(projectPath).length > 0) {
            console.error(
                chalk.red(
                    `Cannot create new project at ${chalk.green(projectPath)} as it already exists.\n`
                )
            );
            process.exit(1);
        }
    };

    /**
     * @param {string} projectPath
     */
    const copyTemplate = projectPath => {
        console.log(`Creating new project at ${chalk.green(projectPath)}`);

        copySync(path.join(sourceDir, "template"), projectPath, {
            errorOnExist: true,
            overwrite: false,
        });

        // Not keeping these files in the template directory allows the template
        // code to be checked from within this project.
        copySync(
            path.join(sourceDir, "config/tsconfig.json.template"),
            path.join(projectPath, "tsconfig.json"),
            {
                errorOnExist: true,
                overwrite: false,
            }
        );
        copySync(
            path.join(sourceDir, "config/eslint.config.js.template"),
            path.join(projectPath, "eslint.config.js"),
            {
                errorOnExist: true,
                overwrite: false,
            }
        );
        // Rename gitignore after the fact to prevent npm from renaming it to .npmignore
        // See: https://github.com/npm/npm/issues/1862
        moveSync(path.join(projectPath, "gitignore"), path.join(projectPath, ".gitignore"));
    };

    /**
     * @param {string} projectPath
     */
    const updateWebTemplateContent = projectPath => {
        const randomNamespace = `custom.${crypto.randomBytes(4).toString("hex")}`;

        const filesToUpdate = [
            path.join(projectPath, "app/layout.xml"),
            path.join(projectPath, "src/index.ts"),
        ];

        for (const fileToUpdate of filesToUpdate) {
            const contents = fs.readFileSync(fileToUpdate, { encoding: "utf8" });
            const newContents = contents.replace(/custom\.foo/g, randomNamespace);
            fs.writeFileSync(fileToUpdate, newContents);
        }
    };

    /**
     * @param { string } projectPath
     */
    const updateWorkflowTemplateContent = projectPath => {
        const uuid = crypto.randomUUID();

        const filesToUpdate = [path.join(projectPath, "uuid.js")];

        for (const fileToUpdate of filesToUpdate) {
            const contents = fs.readFileSync(fileToUpdate, { encoding: "utf8" });
            const newContents = contents.replace(/<uuid>/g, uuid);
            fs.writeFileSync(fileToUpdate, newContents);
        }
    };

    /**
     * @param {string} projectPath
     */
    const installNpmDeps = projectPath => {
        console.log(`Installing packages. This might take a couple minutes.\n`);
        /**
         * @type {string}
         */
        const selfVersion = JSON.parse(
            fs.readFileSync(path.join(sourceDir, "package.json"), {
                encoding: "utf-8",
            })
        ).version;

        // First install existing deps.
        checkSpawnSyncResult(
            spawn.sync("npm", ["install"], {
                cwd: projectPath,
                stdio: "inherit",
            })
        );

        // Copy a freshly packaged instance of this repo to install from if this
        // is a local dev copy. This is done because eslint no longer plays nice
        // with linked repos.
        if (process.env.SDK_LOCAL_DEV === "true") {
            fs.copyFileSync(
                path.join(sourceDir, `vertigis-${projectType}-sdk-0.0.0-semantically-released.tgz`),
                path.join(projectPath, `vertigis-${projectType}-sdk.tgz`)
            );
            fs.unlinkSync(
                path.join(sourceDir, `vertigis-${projectType}-sdk-0.0.0-semantically-released.tgz`)
            );
        }

        // Add SDK and runtime packages.
        checkSpawnSyncResult(
            spawn.sync(
                "npm",
                [
                    "install",
                    "--save-dev",
                    "--save-exact",
                    process.env.SDK_LOCAL_DEV === "true"
                        ? path.join(projectPath, `./vertigis-${projectType}-sdk.tgz`)
                        : `@vertigis/${projectType}-sdk@${selfVersion}`,
                    `@vertigis/${projectType}`,
                ],
                {
                    cwd: projectPath,
                    stdio: "inherit",
                }
            )
        );
    };

    /**
     * Initialize newly cloned directory as a git repo.
     *
     * @param {string} projectPath
     */
    const gitInit = projectPath => {
        console.log(`Initializing git in ${projectPath}\n`);
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        spawn.sync(`git init -b main`, { cwd: projectPath }).status;
    };

    const printSuccess = () => {
        console.log(`${chalk.green("Success!")} Created ${targetName} at ${targetPath}\n`);
        console.log("Inside that directory, you can run several commands:\n");
        if (projectType === "workflow") {
            console.log(chalk.cyan(`  npm run generate`));
            console.log("    Generate new activities and form elements.\n");
        }
        console.log(chalk.cyan(`  npm start`));
        console.log("    Starts the development server.\n");
        console.log(chalk.cyan(`  npm run build`));
        console.log("    Bundles the app into static files for production.\n");
        console.log("We suggest that you begin by typing:\n");
        console.log(chalk.cyan(`  cd ${targetName}`));
        console.log(chalk.cyan("  npm start\n"));
        console.log(
            `You can learn more by visiting https://developers.vertigisstudio.com/docs/${projectType}/sdk-overview/`
        );
    };

    checkDirectoryPath(targetPath);
    copyTemplate(targetPath);
    if (projectType === "web") {
        updateWebTemplateContent(targetPath);
    } else {
        updateWorkflowTemplateContent(targetPath);
    }
    installNpmDeps(targetPath);
    gitInit(targetPath);
    printSuccess();
};

export default create;
