// @ts-check
"use strict";

import { $ } from "execa";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

process.env.OPEN_BROWSER = "false";
process.env.SDK_LOCAL_DEV = "true";
process.env.SMOKE_TEST = "true";

const sdkDirectory = "test/sdk";

const dirName = path.dirname(fileURLToPath(import.meta.url));
const sdkPath = path.join(dirName, "../sdk");
const scriptsPath = path.join(sdkPath, "package/scripts");
const configPath = path.join(sdkPath, "package/config");

async function downloadSdk() {
    console.log(
        `Downloading and extracting the @vertigis/${process.env.SDK_PLATFORM}-sdk package:`
    );

    await $`mkdir ${sdkDirectory}`;
    // Change this before committing, provide dev instruction in README
    await $`npm pack ../vertigis-${process.env.SDK_PLATFORM}-sdk --pack-destination ${sdkDirectory}`
        .pipe`tr -d [:space:]`.pipe`xargs -I % tar -xzf ${sdkDirectory}/% -C ${sdkDirectory}`;
}

async function repathImports() {
    console.log("\nRepathing @vertigis/sdk-library imports to point to this local copy.");

    const scriptFiles = await fs.readdir(scriptsPath);
    const configFiles = await fs.readdir(configPath);

    /**
     * @param {import("fs").PathLike} filePath
     */
    const repath = async filePath => {
        const originalFile = await fs.readFile(filePath, "utf-8");
        const repathedFile = originalFile.replaceAll(`"@vertigis/sdk-library`, `"../../../..`);
        return fs.writeFile(filePath, repathedFile);
    };

    await Promise.all(
        scriptFiles.map(async script => {
            const filePath = path.join(scriptsPath, script);
            await repath(filePath);
        })
    );
    await Promise.all(
        configFiles.map(async config => {
            const filePath = path.join(configPath, config);
            await repath(filePath);
        })
    );

    // The testing script is run directly, not imported.
    const testFilePath = path.join(sdkPath, "package/test/index.js");
    const testFile = await fs.readFile(testFilePath, "utf8");
    const repathedTestFile = testFile.replace("node_modules/@vertigis/sdk-library", "../../..");
    await fs.writeFile(testFilePath, repathedTestFile);
}

async function executeTests() {
    console.log(`\nExecuting end-to-end tests for @vertigis/${process.env.SDK_PLATFORM}-sdk`);

    await $({
        cwd: `${sdkDirectory}/package`,
        node: true,
        stderr: "inherit",
        stdout: "inherit",
    })`test/index.js`;

    console.log("\nSuccess!");
}

async function cleanup() {
    console.log("\nCleaning up SDK folder...");
    await fs.rm(sdkPath, { recursive: true });
    console.log("Done cleaning.");
}

process.env.SDK_PLATFORM = "workflow";

try {
    await downloadSdk();
    await repathImports();
    await executeTests();
    await cleanup();
} catch (error) {
    console.log(error);
    await cleanup();
    process.exit(1);
}

// Run Web tests.
// try {
//     await downloadSdk("web");
//     await repathImports();
//     await executeTests("web");
// } catch (error) {
//     console.log(error);
//     cleanup();
//     process.exit(1);
// }

// try {
//     cleanup();
// } catch {
//     console.error(
//         "\n\nFailed to clean up. You may need to remove the `test/sdk` directory manually.\n"
//     );
//     process.exit(1);
// }

process.exit();
