// @ts-check
"use strict";

import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import semver from "semver";

/**
 * @typedef {"Changed" | "Added" | "Removed" | "Fixed"} Category
 */

/**
 * A software product that has a changelog.
 *
 * @typedef {object} Source
 * @property {string} name The name in the build banner, for example `web-sdk`.
 * @property {string | undefined} version The version that built the library, or `undefined` if it is unknown.
 * @property {string | undefined} markdown The content of the changelog, or `undefined` if the file is missing.
 */

/**
 * @typedef {object} Release
 * @property {string} version
 * @property {string} date The release date in ISO format, for example `2026-10-15`.
 * @property {{ category: Category, item: import("mdast").ListItem }[]} items
 */

/**
 * @typedef {object} Entry
 * @property {string} source The name of the source, for example `web-sdk`.
 * @property {string} version The version of the release that contains the entry.
 * @property {string} date The release date in ISO format.
 * @property {Category} category
 * @property {boolean} breaking
 * @property {import("mdast").ListItem} item
 */

/**
 * The change categories of the Common Changelog format, in the output order.
 *
 * @type {Category[]}
 */
const categories = ["Changed", "Added", "Removed", "Fixed"];

/**
 * @param {string} value
 *
 * @returns {import("mdast").Text}
 */
const text = value => ({ type: "text", value });

/**
 * @param {string} value
 *
 * @returns {import("mdast").InlineCode}
 */
const inlineCode = value => ({ type: "inlineCode", value });

/**
 * @param {...import("mdast").PhrasingContent} children
 *
 * @returns {import("mdast").Emphasis}
 */
const emphasis = (...children) => ({ type: "emphasis", children });

/**
 * @param {...import("mdast").PhrasingContent} children
 *
 * @returns {import("mdast").Paragraph}
 */
const paragraph = (...children) => ({ type: "paragraph", children });

/**
 * @param {import("mdast").Heading["depth"]} depth
 * @param {string} value
 *
 * @returns {import("mdast").Heading}
 */
const heading = (depth, value) => ({ type: "heading", depth, children: [text(value)] });

/**
 * @param {import("mdast").ListItem[]} items
 *
 * @returns {import("mdast").List}
 */
const list = items => ({ type: "list", spread: false, children: items });

/**
 * @param {...(import("mdast").BlockContent | import("mdast").DefinitionContent)} children
 *
 * @returns {import("mdast").ListItem}
 */
const listItem = (...children) => ({ type: "listItem", children });

/**
 * @param {...import("mdast").RootContent} children
 *
 * @returns {import("mdast").Root}
 */
const root = (...children) => ({ type: "root", children });

/**
 * Get the version of a software product from the banner of a built library.
 *
 * @param {string} banner
 * @param {string} name The name in the banner, for example `web-sdk`.
 *
 * @returns {string | undefined} The version, or `undefined` if the banner does not contain it.
 */
export const getVersion = (banner, name) => new RegExp(`${name} v(\\d+\\.\\d+\\.\\d+)`).exec(banner)?.[1];

/**
 * @param {import("mdast").RootContent} node
 *
 * @returns {boolean}
 */
const isReleaseHeading = node => node.type === "heading" && node.children[0]?.type === "linkReference";

/**
 * Get the version and the date from a release heading, for example `## [2.1.7] - 2026-10-15`.
 *
 * @param {import("mdast").Heading} node
 *
 * @returns {Release | undefined} A release with no items, or `undefined` if the version is not valid.
 */
const toRelease = node => {
    const [label, suffix] = node.children;
    if (label.type !== "linkReference" || !semver.valid(label.label)) {
        return undefined;
    }

    const date = suffix?.type === "text" ? /\d{4}-\d{2}-\d{2}/.exec(suffix.value)?.[0] : undefined;
    return { version: label.label, date: date ?? "", items: [] };
};

/**
 * Get the category from a category heading, for example `### Changed`.
 *
 * @param {import("mdast").Heading} node
 *
 * @returns {Category | undefined} The category, or `undefined` if the heading is not a category.
 */
const toCategory = node => {
    const [first] = node.children;
    return first?.type === "text" ? categories.find(category => category === first.value) : undefined;
};

/**
 * Parse a changelog in the Common Changelog format.
 *
 * @param {string | undefined} markdown
 *
 * @returns {Release[]}
 */
const parseChangelog = markdown => {
    /** @type {Release[]} */
    const releases = [];
    /** @type {Release | undefined} */
    let release;
    /** @type {Category | undefined} */
    let category;

    // Gather the lists of changes in each category from each release.
    fromMarkdown(markdown ?? "").children.forEach(node => {
        if (node.type === "heading" && isReleaseHeading(node)) {
            release = toRelease(node);
            category = undefined;
            if (release) {
                releases.push(release);
            }
            return;
        }

        if (release && node.type === "heading") {
            category = toCategory(node);
            return;
        } 
        
        if (release && category && node.type === "list") {
            const items = node.children.filter(item => item.children[0]?.type === "paragraph");
            release.items.push(...items.map(item => ({ category, item })));
            return;
        }

    });

    return releases;
};

/**
 * Breaking changes start with bold text, for example `**Breaking:**`. Other
 * changes will always start with plain text.
 *
 * @param {import("mdast").ListItem} item
 *
 * @returns {boolean}
 */
const isBreaking = item => {
    const [first] = item.children;
    return first?.type === "paragraph" && first.children[0]?.type === "strong";
};

/**
 * Get the changelog entries of a source that are newer than the version that
 * built the library (or the supplied date). If the version is unknown, get all
 * entries.
 *
 * @param {Source} source
 * @param {boolean} breakingOnly 
 * @param {Date | false} timeRange
 *
 * @returns {Entry[]}
 */
const getEntries = (source, breakingOnly, timeRange) =>
    parseChangelog(source.markdown)
        .filter(release => timeRange ? new Date(release.date) >= timeRange : semver.gt(release.version, source.version ?? "0.0.0"))
        .flatMap(({ version, date, items }) =>
            items.map(({ category, item }) => ({
                source: source.name,
                version,
                date,
                category,
                breaking: isBreaking(item),
                item,
            }))
        )
        .filter(entry => entry.breaking || !breakingOnly);

/**
 * Sort the breaking entries first, then the newest entries first.
 *
 * @param {Entry} a
 * @param {Entry} b
 *
 * @returns {number}
 */
const compareEntries = (a, b) => Number(b.breaking) - Number(a.breaking) || b.date.localeCompare(a.date);

/**
 * Copy the list item of an entry, adding the source at the start and the
 * version at the end. [source] original message (version)
 * 
 * @param {Entry} entry
 *
 * @returns {import("mdast").ListItem}
 */
const renderEntry = ({ source, version, item }) => {
    // parseChangelog keeps only the items that start with a paragraph.
    const [first, ...rest] = item.children;
    const { children } = /** @type {import("mdast").Paragraph} */ (first);

    return {
        ...item,
        children: [paragraph(inlineCode(`[${source}]`), text(" "), ...children, text(` (${version})`)), ...rest],
    };
};

/**
 * @param {Source[]} sources
 * @param {string} changeKind
 * @param {Date | false} startDate
 *
 * @returns {import("mdast").RootContent[]}
 */
const renderIntro = (sources, changeKind, startDate) => [
    paragraph(text(startDate ? `This changelog shows all valid entries from ${startDate.toISOString().slice(0, 10)} to the present.` : "This changelog is valid for library code built against the following versions:")),
    (!startDate && list(
        sources.map(({ name, version }) =>
            listItem(paragraph(inlineCode(`[${name}]`), text(`: ${version ?? "unknown"}`)))
        )
    )),
    paragraph(
        text(
            `Please examine these ${changeKind} carefully for those that may affect your project.`
        )
    ),
].filter(node => !!node);

/**
 * Make a Markdown report of the changes since the software versions that built
 * a library.
 *
 * @param {Source[]} sources
 * @param {boolean} [breakingOnly]
 * @param {Date | false} [startDate]
 *
 * @returns {string}
 */
export const renderChangelog = (sources, breakingOnly = false, startDate = false) => {
    const changeKind = breakingOnly ? "breaking changes" : "changes";
    const entries = sources.flatMap(source => getEntries(source, breakingOnly, startDate)).sort(compareEntries);
    const sections = categories.flatMap(category => {
        const items = entries.filter(entry => entry.category === category);
        return items.length > 0 ? [heading(2, category), list(items.map(renderEntry))] : [];
    });

    return toMarkdown(
        root(
            heading(1, "SDK Changelog"),
            ...(renderIntro(sources, changeKind, startDate)),
            ...(sections.length > 0 ? sections : [paragraph(emphasis(text(`No ${changeKind} found`)))])
        )
    );
};
