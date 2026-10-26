// @ts-check
"use strict";

import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import semver from "semver";

import { paragraph, inlineCode, text, listItem, emphasis, heading, list, root } from "./mdastUtils.js";

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
 * @typedef {object} ProductGroup
 * @property {string} title The heading of the group, for example `web 5.44.0`.
 * @property {Entry[]} entries
 */

/**
 * The versions of the sources that the product depends on. For each source,
 * the version that each product release depends on. For example,
 * `{ "react-ui": { "5.44.0": "21.12.3" } }`.
 *
 * @typedef {Record<string, Record<string, string>>} DependencyVersions
 */

/**
 * The change categories of the Common Changelog format, in the output order.
 *
 * @type {Category[]}
 */
const categories = ["Changed", "Added", "Removed", "Fixed"];

/**
 *
 * This is the comment at the top of the compiled library that specifies
 * the versions used. It should look something like:
 *
 *  /*!
 *   * library id 1b54c1c4c491bf1e
 *   * web v5.43.1
 *   * web-sdk v3.1.0
 *   * sdk-library v2.1.6
 *   * react-ui v22.0.0
 *    ...
 *
 * @param {string} compiledLibrary
 *
 * @returns {string}
 */
export const extractBannerFromLibrary = compiledLibrary =>
    /^\/\*!(?:\r\n|\r|\n)([\S\s]*?)(?:\r\n|\r|\n) \*\//.exec(compiledLibrary)?.[1];

/**
 * Check that a value is a date in ISO format, for example `2026-10-15`.
 *
 * @param {string} value
 *
 * @returns {boolean}
 */
export const isIsoDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    // Node accepts some days that do not exist. For example, 2026-02-30 becomes 2026-03-02.
    const date = new Date(value);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

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
 * Get the version and the date from a release heading, for example `## [2.1.7]
 * - 2026-10-15`. It should be optional for the release link to exist.
 *
 * @param {import("mdast").RootContent} node
 *
 * @returns {Release | undefined} A release with no items, or `undefined` if
 * this was not a valid release heading.
 */
const toRelease = node => {
    if (node.type !== "heading") {
        return undefined;
    }

    const [versionTag, suffix] = node.children;
    if (versionTag.type !== "text" && versionTag.type !== "linkReference") {
        return undefined;
    }

    const version = semver.valid(versionTag.type === "text" ? versionTag.value : versionTag.label);
    if (!version) {
        return undefined;
    }

    const date = suffix?.type === "text" ? /\d{4}-\d{2}-\d{2}/.exec(suffix.value)?.[0] : undefined;
    return { version, date: date ?? "", items: [] };
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
 * Get the releases of a source that are in the range of the report. With a
 * start date, these are the releases on or after the start date. Without a
 * start date, these are the releases that are newer than the version that
 * built the library, or all releases if that version is unknown.
 *
 * @param {Source} source
 * @param {string} [startDate] The start date in ISO format.
 *
 * @returns {Release[]}
 */
const getReleasesInRange = (source, startDate) =>
    parseChangelog(source.markdown).filter(release =>
        startDate ? release.date >= startDate : semver.gt(release.version, source.version ?? "0.0.0")
    );

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
        const newRelease = toRelease(node);
        if (newRelease) {
            release = newRelease;
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
 * Get the changelog entries of the releases of a source.
 *
 * @param {string} sourceName The name of the source, for example `web-sdk`.
 * @param {Release[]} releases
 * @param {boolean} breakingOnly If `true`, get only the breaking changes.
 *
 * @returns {Entry[]}
 */
const getEntries = (sourceName, releases, breakingOnly) =>
    releases
        .flatMap(({ version, date, items }) =>
            items.map(({ category, item }) => ({
                source: sourceName,
                version,
                date,
                category,
                breaking: isBreaking(item),
                item,
            }))
        )
        .filter(entry => entry.breaking || !breakingOnly);

/**
 * Check if a product release includes an entry. If the release depends on the
 * source of the entry, it includes the entries up to the version that it
 * depends on. If not, it includes the entries up to its release date.
 *
 * @param {Release} release A release of the product.
 * @param {Entry} entry
 * @param {DependencyVersions} dependencyVersions
 *
 * @returns {boolean}
 */
const includesEntry = (release, entry, dependencyVersions) => {
    const dependencyVersion = dependencyVersions[entry.source]?.[release.version];
    return dependencyVersion ? semver.lte(entry.version, dependencyVersion) : entry.date <= release.date;
};

/**
 * Group the entries by the releases of the product. An entry is in the group
 * of the first product release that includes it. The entries that no product
 * release includes yet are in a separate group.
 *
 * @param {Entry[]} entries
 * @param {Release[]} productReleases The releases of the product. There must be at least one.
 * @param {string} productName The name of the product, for example `web`.
 * @param {DependencyVersions} dependencyVersions
 *
 * @returns {ProductGroup[]} The groups, newest first.
 */
const groupByProductRelease = (entries, productReleases, productName, dependencyVersions) => {
    // Newest first. This is also the order of the groups.
    const releases = [...productReleases].sort((a, b) => b.date.localeCompare(a.date));

    /**
     * @param {Entry} entry
     *
     * @returns {Release | undefined} The oldest release that includes the entry, or `undefined` if there is none.
     */
    const getFirstRelease = entry =>
        releases.filter(release => includesEntry(release, entry, dependencyVersions)).at(-1);

    const groups = releases.map(release => ({
        title: `${release.version} (${release.date})`,
        entries: entries.filter(entry => getFirstRelease(entry) === release),
    }));

    const [newest] = releases;
    const laterEntries = entries.filter(entry => !getFirstRelease(entry));

    return laterEntries.length > 0
        ? [{ title: `Post ${productName} ${newest.version}`, entries: laterEntries }, ...groups]
        : groups;
};

/**
 * Copy the list item of an entry, adding the source at the start and the
 * version at the end. [source] original message (version)
 *
 * @param {Entry} entry
 *
 * @returns {import("mdast").ListItem}
 */
const renderEntry = ({ source, version, item }) => {
    // It is not expected that an entry contains more than one paragraph.
    const [firstParagraph] = item.children;
    const { children } = /** @type {import("mdast").Paragraph} */ (firstParagraph);

    return {
        ...item,
        children: [paragraph(inlineCode(`[${source}]`), text(" "), ...children, text(` (${version})`))],
    };
};

/**
 * @param {object} options
 * @param {Source[]} options.sources
 * @param {string} options.changeKind
 * @param {string} [options.startDate]
 * @param {string} [options.groupedBy]
 *
 * @returns {import("mdast").RootContent[]}
 */
const renderIntro = ({ sources, changeKind, startDate, groupedBy }) => [
    ...(groupedBy
        ? [
              paragraph(
                  text("This changelog shows changes that may affect "),
                  inlineCode(`${groupedBy}-sdk`),
                  text("projects, grouped by "),
                  inlineCode(`${groupedBy}`),
                  text(" version.")
              ),
          ]
        : []),
    ...(startDate
        ? [paragraph(text(`This changelog shows all entries from ${startDate} to the present.`))]
        : [
              paragraph(text("This changelog is valid for library code built against the following versions:")),
              list(
                  sources.map(({ name, version }) =>
                      listItem(paragraph(inlineCode(`[${name}]`), text(`: ${version ?? "unknown"}`)))
                  )
              ),
          ]),
    paragraph(text(`Please examine these ${changeKind} carefully for any that may affect your project.`)),
];

/**
 * Render a section for each category that has entries.
 *
 * @param {Entry[]} entries
 * @param {import("mdast").Heading["depth"]} depth The level of the category headings.
 * @param {string} changeKind
 *
 * @returns {import("mdast").RootContent[]} The sections, or a message if there are no entries.
 */
const renderCategories = (entries, depth, changeKind) => {
    if (entries.length === 0) {
        return [paragraph(emphasis(text(`No ${changeKind} found`)))];
    }

    return categories.flatMap(category => {
        const items = entries.filter(entry => entry.category === category);
        return items.length > 0 ? [heading(depth, category), list(items.map(renderEntry))] : [];
    });
};

/**
 * Render the changes. If there is a product name, group the changes by the
 * releases of the product.
 *
 * @param {object} options
 * @param {Entry[]} options.entries
 * @param {string} options.changeKind
 * @param {string | undefined} options.productName
 * @param {Release[]} options.productReleases
 * @param {DependencyVersions} options.dependencyVersions
 *
 * @returns {import("mdast").RootContent[]}
 */
const renderSections = ({ entries, changeKind, productName, productReleases, dependencyVersions }) => {
    if (!productName) {
        return renderCategories(entries, 2, changeKind);
    }

    if (productReleases.length === 0) {
        return [...renderCategories(entries, 2, changeKind)];
    }

    const groups = groupByProductRelease(entries, productReleases, productName, dependencyVersions);
    return [...groups.flatMap(group => [heading(2, group.title), ...renderCategories(group.entries, 3, changeKind)])];
};

/**
 * Make a Markdown report of the changes since the software versions that built
 * a library, or since a start date.
 *
 * @param {object} options
 * @param {Source[]} options.sources
 * @param {string} [options.productName] The name of the product source, for example `web`.
 * @param {DependencyVersions} [options.dependencyVersions] The versions of the sources that the product depends on. A
 * product release includes the entries of these sources up to the version that it depends on.
 * @param {boolean} [options.breakingOnly] If `true`, include only the breaking changes.
 * @param {Date} [options.startDate] If set, include the releases on or after this date, and not the releases after the
 * built versions.
 *
 * @returns {string}
 */
export const renderChangelog = ({ sources, breakingOnly, productName, dependencyVersions = {}, startDate }) => {
    const changeKind = breakingOnly ? "breaking changes" : "changes";
    const startDateISOString = startDate ? startDate.toISOString().slice(0, 10) : undefined;

    const sourceReleases = sources.map(source => ({
        name: source.name,
        releases: getReleasesInRange(source, startDateISOString),
    }));
    const entries = sourceReleases
        .flatMap(({ name, releases }) => getEntries(name, releases, breakingOnly))
        .sort(compareEntries);
    const productReleases = sourceReleases.find(({ name }) => name === productName)?.releases ?? [];

    return toMarkdown(
        root(
            heading(1, `${productName.charAt(0).toUpperCase()}${productName.slice(1)} SDK Changelog`),
            ...renderIntro({
                sources,
                changeKind,
                startDate: startDateISOString,
                groupedBy: productReleases.length > 0 && productName,
            }),
            ...renderSections({ entries, changeKind, productName, productReleases, dependencyVersions })
        )
    );
};
