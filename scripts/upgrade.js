// @ts-check
"use strict";

import * as fs from "fs";
import * as path from "path";
import * as spawn from "cross-spawn";
import fetch from "node-fetch";

/**
 * This scripts updates a custom sdk library to point to the latest verstions of
 * the product and product SDK libraries.
 *
 * @param {string} sdkPath
 * @param {"web" | "workflow"} projectType
 */
const upgrade = async (sdkPath, projectType) => {
    const product = `${projectType.charAt(0).toUpperCase()}${projectType.slice(1)}`;

    console.info(`Determining latest versions of ${product} and ${product} SDK...`);

    const responses = await Promise.all([
        fetch(`https://registry.npmjs.com/@vertigis/${projectType}/`),
        fetch(`https://registry.npmjs.com/@vertigis/${projectType}-sdk/`),
    ]);

    const [productInfo, sdkInfo] = await Promise.all(responses.map(r => r.json()));

    /**
     * @type {string}
     */
    // @ts-expect-error: JSON object is not typed
    const latestProduct = productInfo["dist-tags"]?.latest;
    if (!latestProduct) {
        throw new Error(`Unable to determine the latest version of VertiGIS Studio ${product}.`);
    }
    /**
     * @type {string}
     */
    // @ts-expect-error: JSON object is not typed
    const latestSDK = sdkInfo["dist-tags"]?.latest;
    if (!latestSDK) {
        throw new Error(`Unable to determine the latest version VertiGIS Studio ${product} SDK.`);
    }

    const projectPackage = JSON.parse(await fs.promises.readFile("package.json", "utf8"));

    // Update the base product and SDK to latest versions.
    projectPackage.devDependencies[`@vertigis/${projectType}`] = `^${latestProduct}`;
    projectPackage.devDependencies[`@vertigis/${projectType}-sdk`] = `^${latestSDK}`;

    // Check for old eslint configuration and fix it.
    if (fs.existsSync(".eslintrc.js") && !fs.existsSync("eslint.config.js")) {
        console.info("Adding new default configuration for eslint to 'eslint.config.js'.");
        console.info(
            "If you have existing '.eslintrc.js' configuration you will need to migrate any custom config to the new file."
        );
        fs.copyFileSync(
            path.join(sdkPath, "./config/eslint.config.js.template"),
            "eslint.config.js"
        );
    }

    // Change the type from "commonjs" to "module"
    if (projectPackage.type === "commonjs" || !projectPackage.type) {
        console.info("Changing the type of the project to 'module'.");
        projectPackage.type = "module";
    }

    console.info("Updating package.json...");
    await fs.promises.writeFile(
        "package.json",
        JSON.stringify(projectPackage, undefined, 4),
        "utf8"
    );

    console.info("Running npm install...");
    spawn.sync("npm", ["install"]);
};

export default upgrade;
