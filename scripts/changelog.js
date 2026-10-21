// @ts-check
"use strict";

import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { extractBannerFromLibrary, getVersion, renderChangelog } from "../lib/shared/changelogUtils.js";
import paths from "../config/paths.js";

/**
 * @typedef {object} SourceLocation
 * @property {string} name The name in the build banner, for example `web-sdk`.
 * @property {string} changelogPath The path of the changelog, relative to the source folder.
 */

/**
 * Get the software products that can have changes that affect a project.
 *
 * @param {"web" | "workflow"} projectType
 *
 * @returns {SourceLocation[]}
 */
const getSources = projectType => [
    { name: projectType, changelogPath: `node_modules/@vertigis/${projectType}/CHANGELOG.md` },
    { name: `${projectType}-sdk`, changelogPath: "CHANGELOG.md" },
    { name: "sdk-library", changelogPath: "node_modules/@vertigis/sdk-library/CHANGELOG.md" },
    // Only Web projects use react-ui.
    ...(projectType === "web"
        ? [{ name: "react-ui", changelogPath: "node_modules/@vertigis/react-ui/CHANGELOG.md" }]
        : []),
];

/**
 * Read a changelog file. Show a warning if the file is missing.
 *
 * @param {string} filePath
 * @param {string} name The name of the software product, for the warning.
 *
 * @returns {Promise<string | undefined>} The content, or `undefined` if the file is missing.
 */
const readChangelog = async (filePath, name) => {
    try {
        return await fs.readFile(filePath, "utf8");
    } catch {
        console.warn(`Could not find a changelog for the ${name} repository.`);
        return undefined;
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
        .options({ breakingOnly: { type: "boolean" }, path: { type: "string" }, startDate: { type: "string" } })
        .parseSync();

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

    const sources = await Promise.all(
        getSources(projectType).map(async ({ name, changelogPath }) => ({
            name,
            version: getVersion(banner, name),
            markdown: await readChangelog(path.join(sourceDir, changelogPath), name),
        }))
    );

    return renderChangelog(sources, breakingOnly, startDate ? new Date(startDate) : undefined);
};

export default changelog;
