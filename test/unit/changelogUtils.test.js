// @ts-check
"use strict";

import { describe, expect, it } from "@jest/globals";

import { extractBannerFromLibrary, getVersion, isIsoDate, renderChangelog } from "../../lib/shared/changelogUtils.js";

/**
 * Make the expected report.
 *
 * @param {string[] | string} since The lines of the version list, or the start date in ISO format.
 * @param {string} changeKind `"breaking changes"` or `"changes"`.
 * @param {string[]} body The lines after the intro.
 *
 * @returns {string}
 */
const expectedReport = (since, changeKind, body) =>
    [
        "# SDK Changelog",
        "",
        ...(typeof since === "string"
            ? [`This changelog shows all valid entries from ${since} to the present.`]
            : ["This changelog is valid for library code built against the following versions:", "", ...since]),
        "",
        `Please examine these ${changeKind} carefully for those that may affect your project.`,
        "",
        ...body,
        "",
    ].join("\n");

/**
 * Make a changelog with one release.
 *
 * @param {string} version
 * @param {string} date The release date in ISO format.
 * @param {string[]} lines The lines of Markdown after the release heading.
 *
 * @returns {string}
 */
const makeRelease = (version, date, lines) =>
    [`## [${version}] - ${date}`, "", ...lines, "", `[${version}]: https://example.com/${version}`].join("\n");



// @vertigis/web does not publish a changelog yet. This test changelog uses the
// Common Changelog format, like the SDK changelogs.
const webChangelog = [
    "# Changelog",
    "",
    "## [5.44.0] - 2026-09-20",
    "",
    "### Changed",
    "",
    "- **Breaking:** rename the `results.display` command",
    "",
    "### Added",
    "",
    "- Add the `region` property to `MapModel`",
    "",
    "## [5.43.0] - 2026-08-05",
    "",
    "### Removed",
    "",
    "- **Breaking:** remove the deprecated `menu.show` operation",
    "",
    "### Fixed",
    "",
    "- Fix the scale bar in print layouts",
    "",
    "## [5.42.0] - 2026-06-20",
    "",
    "### Changed",
    "",
    "- **Breaking:** require ArcGIS Maps SDK 4.33",
    "",
    "[5.44.0]: https://example.com/web/5.44.0",
    "[5.43.0]: https://example.com/web/5.43.0",
    "[5.42.0]: https://example.com/web/5.42.0",
].join("\n");

const webSdkChangelog = [
    "# Changelog",
    "",
    "## [1.2.0] - 2026-09-01",
    "",
    "### Fixed",
    "",
    "- Fix the `start` script on Windows",
    "",
    "### Changed",
    "",
    "- **Breaking:** rename the `build` argument",
    "- Update the HTML template",
    "",
    "## [1.1.0] - 2026-06-01",
    "",
    "### Added",
    "",
    "- `generate` script for new projects",
    "- Add the `--port` argument",
    "",
    "## [1.0.0] - 2026-01-15",
    "",
    "### Changed",
    "",
    "- **Breaking:** set `module` to `preserve`",
    "",
    "[1.2.0]: https://example.com/web-sdk/1.2.0",
    "[1.1.0]: https://example.com/web-sdk/1.1.0",
    "[1.0.0]: https://example.com/web-sdk/1.0.0",
].join("\n");

const workflowSdkChangelog = [
    "# Changelog",
    "",
    "## [5.1.0] - 2026-08-12",
    "",
    "### Changed",
    "",
    "- **Breaking:** require `@vertigis/workflow` 5.48 or later",
    "- Set `target` to `es2022` in the base TypeScript config",
    "",
    "### Added",
    "",
    "- Add the `--watch` argument to the `generate` script",
    "",
    "## [5.0.1] - 2026-03-02",
    "",
    "### Fixed",
    "",
    "- Fix the activity metadata for inputs that have a default value",
    "",
    "## [5.0.0] - 2025-11-04",
    "",
    "### Removed",
    "",
    "- **Breaking:** remove support for `uuid.js` in activity packs",
    "",
    "[5.1.0]: https://example.com/workflow-sdk/5.1.0",
    "[5.0.1]: https://example.com/workflow-sdk/5.0.1",
    "[5.0.0]: https://example.com/workflow-sdk/5.0.0",
].join("\n");

const libraryChangelog = [
    "# Changelog",
    "",
    "## [2.1.0] - 2026-07-23",
    "",
    "### Changed",
    "",
    "- **Breaking:** remove the `foo` option",
    "- Bump `webpack` to 6",
    "",
    "## [2.0.0] - 2025-11-04",
    "",
    "### Changed",
    "",
    "- **Breaking:** drop support for Node 18",
    "",
    "[2.1.0]: https://example.com/sdk-library/2.1.0",
    "[2.0.0]: https://example.com/sdk-library/2.0.0",
].join("\n");

const reactUiChangelog = [
    "# Changelog",
    "",
    "## [21.12.0] - 2026-08-28",
    "",
    "### Changed",
    "",
    "- **Breaking:** rename the `onDismiss` prop of `Notification` to `onClose`",
    "",
    "### Fixed",
    "",
    "- Fix the focus ring of `IconButton`",
    "",
    "## [21.11.0] - 2026-05-14",
    "",
    "### Added",
    "",
    "- Add the `NumberInput` component",
    "",
    "### Removed",
    "",
    "- **Breaking:** remove the `Hidden` component",
    "",
    "## [21.10.0] - 2026-03-30",
    "",
    "### Removed",
    "",
    "- **Breaking:** drop support for React 18",
    "",
    "[21.12.0]: https://example.com/react-ui/21.12.0",
    "[21.11.0]: https://example.com/react-ui/21.11.0",
    "[21.10.0]: https://example.com/react-ui/21.10.0",
].join("\n");

// The sources of a Web project.
const webSources = [
    { name: "web", version: "5.42.0", markdown: webChangelog },
    { name: "web-sdk", version: "1.0.0", markdown: webSdkChangelog },
    { name: "sdk-library", version: "2.0.0", markdown: libraryChangelog },
    { name: "react-ui", version: "21.10.0", markdown: reactUiChangelog },
];

const webVersions = [
    "* `[web]`: 5.42.0",
    "* `[web-sdk]`: 1.0.0",
    "* `[sdk-library]`: 2.0.0",
    "* `[react-ui]`: 21.10.0",
];

// The sources of a Workflow project. The workflow changelog is missing.
const workflowSources = [
    { name: "workflow", version: "5.48.2", markdown: undefined },
    { name: "workflow-sdk", version: "4.2.0", markdown: workflowSdkChangelog },
    { name: "sdk-library", version: "2.0.0", markdown: libraryChangelog },
];

const workflowVersions = ["* `[workflow]`: 5.48.2", "* `[workflow-sdk]`: 4.2.0", "* `[sdk-library]`: 2.0.0"];

describe("isIsoDate", () => {
    it.each([
        ["an empty value", ""],
        ["a date with no leading zeros", "2026-6-20"],
        ["a date in a different format", "06/20/2026"],
        ["a date with a time", "2026-06-20T00:00:00Z"],
    ])("rejects %s", (_, value) => {
        expect(isIsoDate(value)).toBe(false);
    });
});

describe("extractBannerFromLibrary", () => {
    // The lines of the banner between "/*!" and " */".
    const bannerLines = [
        " * library id 0123456789abcdef",
        " * web v5.43.1",
        " * web-sdk v1.12.0",
        " * sdk-library v2.1.7",
        " * react-ui v21.12.3",
    ];

    // A compiled library that starts with the banner.
    const libraryLines = ["/*!", ...bannerLines, " */", "define([], function () {", "    return {};", "});"];

    it.each(["\n", "\r\n", "\r"])("gets the banner of a library with %j line breaks", lineBreak => {
        expect(extractBannerFromLibrary(libraryLines.join(lineBreak))).toBe(bannerLines.join(lineBreak));
    });

    it("stops at the end of the banner", () => {
        const compiledLibrary = [...libraryLines, "/**", " * This is not the banner.", " */"].join("\n");

        expect(extractBannerFromLibrary(compiledLibrary)).toBe(bannerLines.join("\n"));
    });

    it.each([
        ["the library is empty", ""],
        ["the library does not have a banner", "define([], function () {});"],
        ["the banner is not at the start", ["define([], function () {});", ...libraryLines].join("\n")],
    ])("returns undefined if %s", (_, compiledLibrary) => {
        expect(extractBannerFromLibrary(compiledLibrary)).toBeUndefined();
    });
});

describe("getVersion", () => {
    // The format of the webpack BannerPlugin.
    const webBanner = [
        "/*!",
        " * library id 0123456789abcdef",
        " * web v5.43.1 ",
        " * web-sdk v1.12.0",
        " * sdk-library v2.1.7",
        " * react-ui v21.12.3",
        " */",
    ].join("\n");

    const workflowBanner = [
        "/*!",
        " * library id 0123456789abcdef",
        " * workflow v5.48.2",
        " * workflow-sdk v5.0.1",
        " * sdk-library v2.1.7",
        " */",
    ].join("\n");

    it.each([
        ["web", "5.43.1"],
        ["web-sdk", "1.12.0"],
        ["sdk-library", "2.1.7"],
        ["react-ui", "21.12.3"],
    ])("gets the %s version from the web banner", (name, version) => {
        expect(getVersion(webBanner, name)).toBe(version);
    });

    it.each([
        ["workflow", "5.48.2"],
        ["workflow-sdk", "5.0.1"],
        ["sdk-library", "2.1.7"],
    ])("gets the %s version from the workflow banner", (name, version) => {
        expect(getVersion(workflowBanner, name)).toBe(version);
    });

    it("returns undefined if the banner does not contain the name", () => {
        expect(getVersion(workflowBanner, "react-ui")).toBeUndefined();
    });

    it("returns undefined if the environment var for the version was not set", () => {
        expect(getVersion(" * sdk-library vundefined", "sdk-library")).toBeUndefined();
    });

    it("does not get the SDK version for the product", () => {
        expect(getVersion(" * web-sdk v1.12.0", "web")).toBeUndefined();
    });
});

describe("renderChangelog", () => {
    it("makes a report of all changes since the built versions", () => {
        expect(renderChangelog({ sources: workflowSources })).toBe(
            expectedReport(workflowVersions, "changes", [
                "## Changed",
                "",
                "* `[workflow-sdk]` **Breaking:** require `@vertigis/workflow` 5.48 or later (5.1.0)",
                "* `[sdk-library]` **Breaking:** remove the `foo` option (2.1.0)",
                "* `[workflow-sdk]` Set `target` to `es2022` in the base TypeScript config (5.1.0)",
                "* `[sdk-library]` Bump `webpack` to 6 (2.1.0)",
                "",
                "## Added",
                "",
                "* `[workflow-sdk]` Add the `--watch` argument to the `generate` script (5.1.0)",
                "",
                "## Removed",
                "",
                "* `[workflow-sdk]` **Breaking:** remove support for `uuid.js` in activity packs (5.0.0)",
                "",
                "## Fixed",
                "",
                "* `[workflow-sdk]` Fix the activity metadata for inputs that have a default value (5.0.1)",
            ])
        );
    });

    it("makes a report of the breaking changes since the built versions", () => {
        expect(renderChangelog({ sources: webSources, breakingOnly: true })).toBe(
            expectedReport(webVersions, "breaking changes", [
                "## Changed",
                "",
                "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                "* `[web-sdk]` **Breaking:** rename the `build` argument (1.2.0)",
                "* `[react-ui]` **Breaking:** rename the `onDismiss` prop of `Notification` to `onClose` (21.12.0)",
                "* `[sdk-library]` **Breaking:** remove the `foo` option (2.1.0)",
                "",
                "## Removed",
                "",
                "* `[web]` **Breaking:** remove the deprecated `menu.show` operation (5.43.0)",
                "* `[react-ui]` **Breaking:** remove the `Hidden` component (21.11.0)",
            ])
        );
    });

    it("includes all releases if the version is unknown", () => {
        // @ts-ignore
        const unknownVersion = [{ name: "web-sdk", version: undefined, markdown: webSdkChangelog }];

        expect(renderChangelog({ sources: unknownVersion, breakingOnly: true })).toBe(
            expectedReport(["* `[web-sdk]`: unknown"], "breaking changes", [
                "## Changed",
                "",
                "* `[web-sdk]` **Breaking:** rename the `build` argument (1.2.0)",
                "* `[web-sdk]` **Breaking:** set `module` to `preserve` (1.0.0)",
            ])
        );
    });

    it("does not include the release of the built version", () => {
        const latestVersion = [{ name: "web-sdk", version: "1.2.0", markdown: webSdkChangelog }];

        expect(renderChangelog({ sources: latestVersion, breakingOnly: true })).toBe(
            expectedReport(["* `[web-sdk]`: 1.2.0"], "breaking changes", ["*No breaking changes found*"])
        );
    });

    it("uses the start date instead of the built versions if startDate is set", () => {
        // The report includes web 5.42.0, which is the built version, because its date is the start date. The report
        // does not include react-ui 21.11.0, which is newer than the built version, because its date is before the
        // start date.
        expect(renderChangelog({ sources: webSources, breakingOnly: true, startDate: new Date("2026-06-20") })).toBe(
            expectedReport("2026-06-20", "breaking changes", [
                "## Changed",
                "",
                "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                "* `[web-sdk]` **Breaking:** rename the `build` argument (1.2.0)",
                "* `[react-ui]` **Breaking:** rename the `onDismiss` prop of `Notification` to `onClose` (21.12.0)",
                "* `[sdk-library]` **Breaking:** remove the `foo` option (2.1.0)",
                "* `[web]` **Breaking:** require ArcGIS Maps SDK 4.33 (5.42.0)",
                "",
                "## Removed",
                "",
                "* `[web]` **Breaking:** remove the deprecated `menu.show` operation (5.43.0)",
            ])
        );
    });

    it("ignores the categories that are not in the Common Changelog format", () => {
        const markdown = makeRelease("1.1.0", "2026-06-01", [
            "### Security",
            "",
            "- **Breaking:** fix a vulnerability",
            "",
            "### Changed",
            "",
            "- **Breaking:** rename the `build` argument",
        ]);

        expect(renderChangelog({ sources: [{ name: "web-sdk", version: "1.0.0", markdown }], breakingOnly: true })).toBe(
            expectedReport(["* `[web-sdk]`: 1.0.0"], "breaking changes", [
                "## Changed",
                "",
                "* `[web-sdk]` **Breaking:** rename the `build` argument (1.1.0)",
            ])
        );
    });

    it("ignores the items after a release heading that does not have a valid version", () => {
        const markdown = makeRelease("1.1.0", "2026-06-01", [
            "### Changed",
            "",
            "- **Breaking:** rename the `build` argument",
            "",
            "## [Draft]",
            "",
            "### Changed",
            "",
            "- **Breaking:** remove the `start` script",
            "",
            "[Draft]: https://example.com/draft",
        ]);

        expect(renderChangelog({ sources: [{ name: "web-sdk", version: "1.0.0", markdown }], breakingOnly: true })).toBe(
            expectedReport(["* `[web-sdk]`: 1.0.0"], "breaking changes", [
                "## Changed",
                "",
                "* `[web-sdk]` **Breaking:** rename the `build` argument (1.1.0)",
            ])
        );
    });
});

describe("renderChangelog with groupByVersionOf", () => {
    const groupingRule =
        "The changes are grouped by web version. Each change is in the group of the first web version in this " +
        "report that was released on or after the day of the change.";

    // Two Web releases after the built version. The newest release has no breaking changes.
    const web = {
        name: "web",
        version: "5.43.0",
        markdown: [
            makeRelease("5.45.0", "2026-10-01", ["### Added", "", "- Add the `zoom` command"]),
            makeRelease("5.44.0", "2026-09-20", [
                "### Changed",
                "",
                "- **Breaking:** rename the `results.display` command",
            ]),
        ].join("\n\n"),
    };

    it("groups the changes by the product releases", () => {
        // react-ui 21.11.0 is older than web 5.42.0. It is in the group of web
        // 5.43.0, because the report does not include web 5.42.0.
        expect(renderChangelog({ sources: webSources, breakingOnly: true, productName: "web" })).toBe(
            expectedReport(webVersions, "breaking changes", [
                groupingRule,
                "",
                "## web 5.44.0",
                "",
                "### Changed",
                "",
                "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                "* `[web-sdk]` **Breaking:** rename the `build` argument (1.2.0)",
                "* `[react-ui]` **Breaking:** rename the `onDismiss` prop of `Notification` to `onClose` (21.12.0)",
                "",
                "## web 5.43.0",
                "",
                "### Changed",
                "",
                "* `[sdk-library]` **Breaking:** remove the `foo` option (2.1.0)",
                "",
                "### Removed",
                "",
                "* `[web]` **Breaking:** remove the deprecated `menu.show` operation (5.43.0)",
                "* `[react-ui]` **Breaking:** remove the `Hidden` component (21.11.0)",
            ])
        );
    });

    it("shows each product release, also a release that has no breaking changes", () => {
        expect(renderChangelog({ sources: [web], breakingOnly: true, productName: "web" })).toBe(
            expectedReport(["* `[web]`: 5.43.0"], "breaking changes", [
                groupingRule,
                "",
                "## web 5.45.0",
                "",
                "*No breaking changes found*",
                "",
                "## web 5.44.0",
                "",
                "### Changed",
                "",
                "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
            ])
        );
    });

    it("puts the changes after the newest product release in a separate group", () => {
        const library = {
            name: "sdk-library",
            version: "2.0.0",
            markdown: makeRelease("2.1.0", "2026-10-10", [
                "### Changed",
                "",
                "- **Breaking:** remove the `foo` option",
            ]),
        };

        expect(renderChangelog({ sources: [web, library], productName: "web" })).toBe(
            expectedReport(["* `[web]`: 5.43.0", "* `[sdk-library]`: 2.0.0"], "changes", [
                groupingRule,
                "",
                "## After web 5.45.0",
                "",
                "### Changed",
                "",
                "* `[sdk-library]` **Breaking:** remove the `foo` option (2.1.0)",
                "",
                "## web 5.45.0",
                "",
                "### Added",
                "",
                "* `[web]` Add the `zoom` command (5.45.0)",
                "",
                "## web 5.44.0",
                "",
                "### Changed",
                "",
                "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
            ])
        );
    });

    it("puts a change on the day of a product release in the group of that release", () => {
        const webSdk = {
            name: "web-sdk",
            version: "1.0.0",
            markdown: makeRelease("1.1.0", "2026-09-20", [
                "### Changed",
                "",
                "- **Breaking:** rename the `build` argument",
            ]),
        };

        expect(renderChangelog({ sources: [web, webSdk], productName: "web" })).toBe(
            expectedReport(["* `[web]`: 5.43.0", "* `[web-sdk]`: 1.0.0"], "changes", [
                groupingRule,
                "",
                "## web 5.45.0",
                "",
                "### Added",
                "",
                "* `[web]` Add the `zoom` command (5.45.0)",
                "",
                "## web 5.44.0",
                "",
                "### Changed",
                "",
                "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                "* `[web-sdk]` **Breaking:** rename the `build` argument (1.1.0)",
            ])
        );
    });

    it("does not group the changes if the product changelog is missing", () => {
        expect(renderChangelog({ sources: workflowSources, breakingOnly: true, productName: "workflow" })).toBe(
            expectedReport(workflowVersions, "breaking changes", [
                "This report has no workflow releases, so the changes are not grouped by version.",
                "",
                "## Changed",
                "",
                "* `[workflow-sdk]` **Breaking:** require `@vertigis/workflow` 5.48 or later (5.1.0)",
                "* `[sdk-library]` **Breaking:** remove the `foo` option (2.1.0)",
                "",
                "## Removed",
                "",
                "* `[workflow-sdk]` **Breaking:** remove support for `uuid.js` in activity packs (5.0.0)",
            ])
        );
    });
});
