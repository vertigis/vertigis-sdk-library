// @ts-check
"use strict";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { extractBannerFromLibrary, getVersion, isIsoDate, renderChangelog } from "../lib/shared/changelogUtils.js";
import { downloadPackage } from "../lib/shared/npmUtils.js";
import paths from "../config/paths.js";

/**
 * @typedef {object} SourceLocation
 * @property {string} name The name in the build banner, for example `web-sdk`.
 * @property {string | undefined} changelogPath The absolute path of the changelog, or `undefined` if the package is
 * missing.
 */

/**
 * Download the react-ui package that a Web package uses.
 *
 * @param {string | undefined} webDir The folder of the Web package, or `undefined` if the download failed.
 * @param {string} tempDir The folder for the downloaded packages.
 *
 * @returns {Promise<string | undefined>} The folder of the package, or `undefined` if it is missing.
 */
const downloadReactUi = async (webDir, tempDir) => {
    if (!webDir) {
        console.warn("Could not get the react-ui version, because the web package is missing.");
        return undefined;
    }

    const { dependencies } = JSON.parse(await fs.readFile(path.join(webDir, "package.json"), "utf8"));
    const version = dependencies?.["@vertigis/react-ui"];

    return downloadPackage("react-ui", version, tempDir);
};

/**
 * TEST ONLY. Remove this function and its call in `getSources` when the tests
 * are done.
 *
 * Use the Web repo at `../repos/web/`, relative to the project folder, and do
 * not download the Web package.
 *
 * @param {"web" | "workflow"} projectType
 *
 * @returns {string | undefined} The folder of the Web repo, or `undefined` if this is not a Web project.
 */
const getTestProductDir = projectType => {
    if (projectType !== "web") {
        return undefined;
    }

    const webDir = path.resolve(paths.projRoot, "../../repos/web/");
    console.error(`TEST ONLY: Using the Web repo at ${webDir}. The Web package is not downloaded.`);
    return webDir;
};

/**
 * @param {string | undefined} packageDir
 *
 * @returns {string | undefined} The path of the changelog, or `undefined` if the package is missing.
 */
const getChangelogPath = packageDir => packageDir && path.join(packageDir, "CHANGELOG.md");

/**
 * Get the software products that can have changes that affect a project.
 * Download the products that are not installed with the SDK.
 *
 * @param {"web" | "workflow"} projectType
 * @param {string} sourceDir The root folder of the SDK package.
 * @param {string} tempDir The folder for the downloaded packages.
 *
 * @returns {Promise<SourceLocation[]>}
 */
const getSources = async (projectType, sourceDir, tempDir) => {
    // TEST ONLY: remove `getTestProductDir(projectType) ??` when the tests are done.
    const productDir = getTestProductDir(projectType) ?? (await downloadPackage(projectType, "latest", tempDir));
    // const productDir = await downloadPackage(projectType, "latest", tempDir);

    /** @type {SourceLocation[]} */
    const sources = [
        { name: projectType, changelogPath: getChangelogPath(productDir) },
        // The SDK repos run this script with `npx @vertigis/<projectType>-sdk@latest`.
        // Thus, the SDK is the latest version.
        { name: `${projectType}-sdk`, changelogPath: getChangelogPath(sourceDir) },
        // The SDK repos do not let npm install a new minor or major version of
        // sdk-library automatically. Thus, the sdk-library that runs this
        // script is the version that the latest SDK uses.
        { name: "sdk-library", changelogPath: getChangelogPath(paths.ownPath) },
    ];

    // Only Web projects use react-ui.
    if (projectType === "web") {
        const reactUiDir = await downloadReactUi(productDir, tempDir);
        sources.push({ name: "react-ui", changelogPath: getChangelogPath(reactUiDir) });
    }

    return sources;
};

/**
 * Read a changelog file. Show a warning if the file is missing.
 *
 * @param {string | undefined} filePath The path, or `undefined` if the package is missing.
 * @param {string} name The name of the software product, for the warning.
 *
 * @returns {Promise<string | undefined>} The content, or `undefined` if the file is missing.
 */
const readChangelog = async (filePath, name) => {
    // A missing package already gave a warning.
    if (!filePath) {
        return undefined;
    }

    try {
        return await fs.readFile(filePath, "utf8");
    } catch {
        console.warn(`Could not find a changelog for the ${name} repository.`);
        return undefined;
    }
};

/**
 * Get the built version and the changelog of each software product. Download
 * the packages to a temporary folder, and remove the folder after.
 *
 * @param {"web" | "workflow"} projectType
 * @param {string} sourceDir The root folder of the SDK package.
 * @param {string} banner The banner comment of the built library.
 *
 * @returns {Promise<import("../lib/shared/changelogUtils.js").Source[]>}
 */
const readSources = async (projectType, sourceDir, banner) => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "vertigis-changelog-"));

    try {
        const sources = await getSources(projectType, sourceDir, tempDir);

        // Wait here, so that the cleanup occurs after all files are read.
        return await Promise.all(
            sources.map(async ({ name, changelogPath }) => ({
                name,
                version: getVersion(banner, name),
                markdown: await readChangelog(changelogPath, name),
            }))
        );
    } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
    }
};

/**
 * SDK project changelog script. Make a Markdown report of the changes since a
 * certain time. Control the range returned by supplying either the path to a
 * previously compiled SDK library or a start date.
 *
 * @param {string} sourceDir The root directory of the SDK package.
 * @param {"web" | "workflow"} [projectType] Can also use env var `SDK_PLATFORM`.
 *
 * @returns {Promise<string>}
 */
const changelog = async (sourceDir, projectType = /** @type {"web" | "workflow"} */ (process.env.SDK_PLATFORM)) => {
    const {
        breakingOnly,
        path: argsPath,
        startDate,
    } = yargs(hideBin(process.argv))
        .options({
            breakingOnly: { type: "boolean" },
            path: { type: "string" },
            startDate: { type: "string" },
        })
        .parseSync();

    if (startDate && !isIsoDate(startDate)) {
        console.error(`The start date ${startDate} is not a valid date in the format YYYY-MM-DD. Exiting.`);
        return "";
    }

    // If we don't have a path or a start date, try the default path of
    // "build/main.js". If we do have a start date we'll just use that.
    const libraryPath = argsPath
        ? path.resolve(paths.projRoot, argsPath)
        : !startDate && path.join(paths.projBuild, "main.js");

    let banner = "";
    if (libraryPath) {
        let compiledLibrary = "";
        try {
            compiledLibrary = await fs.readFile(libraryPath, "utf-8");
        } catch {
            console.error(
                `Could not find a compiled SDK library at ${libraryPath} and no start date was supplied. Exiting.`
            );
            return "";
        }

        banner = extractBannerFromLibrary(compiledLibrary);
    }

    const sources = await readSources(projectType, sourceDir, banner);

    return renderChangelog({
        sources,
        breakingOnly,
        productName: projectType,
        startDate: startDate ? new Date(startDate) : undefined,
    });
};

export default changelog;
