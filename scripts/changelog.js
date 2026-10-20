// @ts-check
"use strict";

import fs from "node:fs/promises";
import path from "node:path";

import { getVersion, renderChangelog } from "../lib/shared/changelogUtils.js";

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
 * SDK project changelog script. Make a Markdown report of the changes since the
 * software versions that built a library.
 *
 * @param {object} options
 * @param {string} options.sourceDir The folder that contains the changelogs.
 * @param {string} options.banner The banner comment of the built library.
 * @param {boolean} [options.breakingOnly] If `true` include only the breaking changes.
 * @param {Date} [options.startDate] If set use this date to filter entries instead of the software versions.
 * @param {"web" | "workflow"} [options.projectType] The default is the environment var `SDK_PLATFORM`.
 *
 * @returns {Promise<string>}
 */
const changelog = async ({
    sourceDir,
    banner,
    breakingOnly,
    startDate,
    projectType = /** @type {"web" | "workflow"} */ (process.env.SDK_PLATFORM),
}) => {
    const sources = await Promise.all(
        getSources(projectType).map(async ({ name, changelogPath }) => ({
            name,
            version: getVersion(banner, name),
            markdown: await readChangelog(path.join(sourceDir, changelogPath), name),
        }))
    );

    return renderChangelog(sources, breakingOnly, startDate);
};

export default changelog;
