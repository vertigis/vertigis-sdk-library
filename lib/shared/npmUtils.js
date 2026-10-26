// @ts-check
"use strict";

import fs from "node:fs/promises";
import path from "node:path";
import spawn from "cross-spawn";

import paths from "../../config/paths.js";

// Utilities for working with npm scripts and commands.

/**
 * Run a command and wait for it to complete.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd The folder to run the command in.
 *
 * @returns {string} The standard output of the command.
 */
const run = (command, args, cwd) => {
    const { error, status, stdout, stderr } = spawn.sync(command, args, { cwd, encoding: "utf8" });
    if (error) {
        throw error;
    }

    if (status !== 0) {
        throw new Error(stderr.trim() || `${command} stopped with the exit code ${status}.`);
    }

    return stdout;
};

/**
 * Download a package from the npm registry and extract it. Show a warning if
 * the download fails.
 *
 * @param {string} name The name of the package without `@vertigis/`, for example `web`.
 * @param {string} version A version, a range or a tag, for example `latest`.
 * @param {string} tempDir The folder for the downloaded packages. Each package goes into a folder with its name.
 *
 * @returns {Promise<string | undefined>} The folder of the package, or `undefined` if the download failed.
 */
export const downloadPackage = async (name, version, tempDir) => {
    const spec = `@vertigis/${name}@${version}`;
    const downloadDir = path.join(tempDir, name);

    // Write to stderr, so that stdout contains only the output of the script.
    console.error(`Downloading ${spec}...`);

    try {
        await fs.mkdir(downloadDir);

        // Run npm in the project folder, so that npm uses the .npmrc file of the project.
        const output = run("npm", ["pack", spec, "--pack-destination", downloadDir, "--json"], paths.projRoot);
        const [{ filename }] = JSON.parse(output);

        // Give tar only the file name. GNU tar reads a path that starts with a
        // drive letter, for example `C:\`, as a file on a remote computer.
        run("tar", ["-xzf", filename], downloadDir);
    } catch (error) {
        const { message } = /** @type {Error} */ (error);
        console.warn(`Could not download the ${name} package.\n${message}`);
        return undefined;
    }

    // The tarball of an npm package puts all files in the folder `package`.
    return path.join(downloadDir, "package");
};
