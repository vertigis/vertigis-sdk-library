import fs from "node:fs/promises";
import path from "node:path";
import semver from "semver";

/**
 * Parse the relevant software versions out from the header of the script.
 * Returns `undefined` for any that are missing.
 *
 * @param {string} scriptHeader
 * @param {string} projectType
 *
 * @returns {[string, string, string, string]}
 */
export const getSoftwareVersions = (scriptHeader, projectType) => [
    new RegExp(`${projectType} v(\\d+(\\.\\d+){2,2})`).exec(scriptHeader)?.[1],
    new RegExp(`${projectType}-sdk v(\\d+(\\.\\d+){2,2})`).exec(scriptHeader)?.[1],
    /sdk-library v(\d+(\.\d+){2,2})/.exec(scriptHeader)?.[1],
    /react-ui v(\d+(\.\d+){2,2})/.exec(scriptHeader)?.[1],
];

/**
 * Downloads CHANGELOG.md files for the relevant software products. Missing
 * files are ignored and return `undefined`.
 *
 * @param {string} sourceDir
 * @param {string} projectType
 *
 * @returns {Promise<[string, string, string, string]>}
 */
export const getChangelogFiles = async (sourceDir, projectType) => {
    let productChangelog;
    let sdkChangelog;
    let libraryChangelog;
    let uiChangelog;

    try {
        productChangelog = await fs.readFile(
            path.join(sourceDir, `./node_modules/@vertigis/${projectType}/CHANGELOG.md`)
        );
    } catch {
        // ignore missing file
    }
    try {
        sdkChangelog = await fs.readFile(path.join(sourceDir, "./CHANGELOG.md"));
    } catch {
        // ignore missing file
    }
    try {
        libraryChangelog = await fs.readFile(path.join(sourceDir, "./node_modules/@vertigis/sdk-library/CHANGELOG.md"));
    } catch {
        // ignore missing file
    }
    try {
        uiChangelog = await fs.readFile(`./node_modules/@vertigis/react-ui/CHANGELOG.md`);
    } catch {
        // ignore missing file
    }

    return [productChangelog, sdkChangelog, libraryChangelog, uiChangelog];
};

/**
 * Return all changelog entries that apply to a particular version, categorized
 * by "change" "add" "remove" or "fix" status and tagged with the date (we need this to
 * sort changelog entries from multiple sources into one list).
 *
 * @param {string} fileVersion
 * @param {string} changeSource 
 * @param {import("mdast").Root} changelogTree
 * @param {boolean} breakingOnly
 *
 * @returns {Record<"change" | "add" | "remove" | "fix", { date: number, item:
 * import("mdast").ListItem}[]>}
 */
export const getChangelogEntriesByVersion = (fileVersion = "0.0.0", changeSource, changelogTree, breakingOnly) => {
    /**
     * @type {Record<"change" | "add" | "remove" | "fix", { date: number, item:
     * import("mdast").ListItem}[]>}
     */
    const applicableEntries = { change: [], add: [], remove: [], fix: [] };
    /**
     * @type {Record<string, { index: number, date: number }>}
     */
    const applicableVersionIndices = {};

    // Gather the index and the date of release for every relevant release entry
    // in the changelog tree.
    changelogTree.children.every((child, childIndex) => {
        if (
            child.type === "heading" &&
            child.children[0]?.type === "linkReference" &&
            child.children[1]?.type === "text" &&
            semver.valid(child.children[0].label)
        ) {
            const dateString = child.children[1].value.slice(2);
            const changelogVersion = child.children[0].label;
            const isApplicableVersion = semver.gt(changelogVersion, fileVersion);

            if (isApplicableVersion) {
                applicableVersionIndices[changelogVersion] = { index: childIndex, date: Date.parse(dateString) };
            } else {
                return false;
            }
        }
        return true;
    });

    // Given the indices gathered above, search the ranges corresponding to
    // releases for the "changed" "added" "removed" and "fixed" entries. Populate the
    // return object with all relevant entries and their dates.
    Object.entries(applicableVersionIndices).forEach((entry, index) => {
        const [version, { index: versionIndex, date }] = entry;

        // Find the bounds of the range of entries associated with a version.
        const versionEntryLowerBound = versionIndex + 1;
        const versionEntryUpperBound =
            index === Object.entries(applicableVersionIndices).length - 1
                ? changelogTree.children.length
                : Object.values(applicableVersionIndices)[index + 1].index;

        // Iterate over those bounds
        for (let i = versionEntryLowerBound; i < versionEntryUpperBound; i++) {
            // The list of changes will follow immediately after the category header
            const changeCategoryHeader = changelogTree.children[i];
            const changeEntryList = i + 1 < versionEntryUpperBound && changelogTree.children[i + 1];

            // If we've gone all the way to another version then bail
            if (changeCategoryHeader.type === "heading" && changeCategoryHeader.children[0].type === "linkReference") {
                break;
            }

            // If this is a category header followed by a list, record the
            // changes
            if (
                changeCategoryHeader.type === "heading" &&
                changeCategoryHeader.children[0].type === "text" &&
                changeEntryList?.type === "list"
            ) {
                /**
                 * @type {{ item: import("mdast").ListItem, date: number }[]}
                 */
                const changeEntryItems = [];
                changeEntryList.children.reduce((acc, child) => {
                    const paragraph = child.children[0];
                    const firstTextItem = paragraph.children[0];

                    // Breaking changes will start with a item type of "strong"
                    if (
                        paragraph.type === "paragraph" &&
                        ((firstTextItem.type === "text" && !breakingOnly) || firstTextItem.type === "strong")
                    ) {
                        // Tag each change with the source and version
                        paragraph.children.unshift({
                            type: "text",
                            value: " "
                        })
                        paragraph.children.unshift({
                            type: "inlineCode",
                            value: `[${changeSource}]`,
                        });
                        paragraph.children.push({
                            type: "text",
                            value: ` (${version})`,
                        });
                        acc.push({ item: child, date });
                    }
                    return acc;
                }, changeEntryItems);

                // Keep concatenating changes from different versions.
                switch (changeCategoryHeader.children[0].value) {
                    case "Changed":
                        applicableEntries.change = [...applicableEntries.change, ...changeEntryItems];
                        break;
                    case "Added":
                        applicableEntries.add = [...applicableEntries.add, ...changeEntryItems];
                        break;
                    case "Removed":
                        applicableEntries.remove = [...applicableEntries.remove, ...changeEntryItems];
                        break;
                    case "Fixed":
                        applicableEntries.fix = [...applicableEntries.fix, ...changeEntryItems];
                        break;
                }
            }
        }
    });

    return applicableEntries;
};

/**
 * Sort two changelog entries by "breaking" status and by date. Note that the
 * sort is backwards so that when `map` is called it comes out the right way
 * around.
 *
 * @param {{item: import("mdast").ListItem, date: number}} a
 * @param {{item: import("mdast").ListItem, date: number}} b
 *
 * @returns {number}
 */
export const changeItemComparer = (a, b) => {
    const initialChildA = a.item.children[0];
    const initialChildB = b.item.children[0];

    // First check for the presence of "Breaking". All breaking changes should
    // sort to the top of the list.
    if (initialChildA.type === "paragraph" && initialChildB.type === "paragraph") {
        // This is indexed at 2 because we've already added a change source tag
        // and a spacer to the front of the array.
        const initialTextA = initialChildA.children[2];
        const initialTextB = initialChildB.children[2];

        // We can just use "strong" as an indicator of a breaking change, we
        // don't need to look inside the container.
        if (initialTextA.type === "text" && initialTextB.type === "strong") {
            return 1;
        }
        if (initialTextA.type === "strong" && initialTextB.type === "text") {
            return -1;
        }
    }

    // If there is no "Breaking" or both changes are "Breaking" sort by the date.
    if (a.date > b.date) {
        return -1;
    }
    if (a.date < b.date) {
        return 1;
    }

    return 0;
};
