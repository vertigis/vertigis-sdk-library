// @ts-check
"use strict";

import { describe, expect, it } from "@jest/globals";

import { extractBannerFromLibrary, getVersion, isIsoDate, renderChangelog } from "../../lib/shared/changelogUtils.js";

/**
 * Make the expected report.
 *
 * @param {object} options
 * @param {"web" | "workflow"} options.productName
 * @param {string[] | string} options.since The lines of the version list, or the start date in ISO format.
 * @param {string} options.changeKind `"breaking changes"` or `"changes"`.
 * @param {string[]} options.body The lines after the intro.
 * @param {boolean} options.grouped `true` if the report groups the changes by the product releases.
 *
 * @returns {string}
 */
const expectedReport = ({productName, since, changeKind, grouped, body}) =>
    [
        `# ${productName === "web" ? "Web" : "Workflow"} SDK Changelog`,
        "",
        ...(grouped
            ? [
                  `This changelog shows changes that may affect \`${productName}-sdk\` projects, ` +
                      `grouped by \`${productName}\` version.`,
                  "",
              ]
            : []),
        ...(typeof since === "string"
            ? [`This changelog shows all entries from ${since} to the present.`]
            : ["This changelog is valid for library code built against the following versions:", "", ...since]),
        "",
        `Please examine these ${changeKind} carefully for any that may affect your project.`,
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

const webChangelog = [
    "# Changelog",
    "",
    "## 5.44.0 - 2026-09-20",
    "",
    "### Changed",
    "",
    "- **Breaking:** rename the `results.display` command",
    "",
    "### Added",
    "",
    "- Add the `region` property to `MapModel`",
    "",
    "## 5.43.0 - 2026-08-05",
    "",
    "### Removed",
    "",
    "- **Breaking:** remove the deprecated `menu.show` operation",
    "",
    "### Fixed",
    "",
    "- Fix the scale bar in print layouts",
    "",
    "## 5.42.0 - 2026-06-20",
    "",
    "### Changed",
    "",
    "- **Breaking:** require ArcGIS Maps SDK 4.33",
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

// Two Web releases after the built version. The newest release has no breaking changes.
const nextWebVersions = {
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

// The sources of a Web project.
const webSources = [
    { name: "web", version: "5.42.0", markdown: webChangelog },
    { name: "web-sdk", version: "1.0.0", markdown: webSdkChangelog },
    { name: "sdk-library", version: "2.0.0", markdown: libraryChangelog },
    { name: "react-ui", version: "21.10.0", markdown: reactUiChangelog },
];


// The sources of a Workflow project. The workflow changelog is missing.
const workflowSources = [
    { name: "workflow", version: "5.48.2", markdown: undefined },
    { name: "workflow-sdk", version: "4.2.0", markdown: workflowSdkChangelog },
    { name: "sdk-library", version: "2.0.0", markdown: libraryChangelog },
];

// The format of the webpack BannerPlugin.
const webBanner = [
    "/*!",
    " * library id 0123456789abcdef",
    " * web v5.43.1 ",
    " * web-sdk v1.12.0",
    " * sdk-library v2.1.7",
    " * react-ui v21.12.3",
    " */",
];

const workflowBanner = [
    "/*!",
    " * library id 0123456789abcdef",
    " * workflow v5.48.2",
    " * workflow-sdk v5.0.1",
    " * sdk-library v2.1.7",
    " */",
];

// These match the output in the header of the changelog.
const workflowVersions = [
    "* `[workflow]`: 5.48.2", 
    "* `[workflow-sdk]`: 4.2.0", 
    "* `[sdk-library]`: 2.0.0"
];

const webVersions = [
    "* `[web]`: 5.42.0",
    "* `[web-sdk]`: 1.0.0",
    "* `[sdk-library]`: 2.0.0",
    "* `[react-ui]`: 21.10.0",
];

describe("isIsoDate", () => {
    it("rejects an empty value", () => {
        expect(isIsoDate("")).toBe(false);
    });

    it("rejects a date with no leading zeros", () => {
        expect(isIsoDate("2026-6-20")).toBe(false);
    });

    it("rejects a date in a different format", () => {
        expect(isIsoDate("06/20/2026")).toBe(false);
    })

    it("rejects a date with a time", () => {
        expect(isIsoDate("2026-06-20T00:00:00Z")).toBe(false);
    })
});

describe("extractBannerFromLibrary", () => {
    // The lines of the banner between "/*!" and " */".
    const webBannerLines = webBanner.slice(1,-1);
    const workflowBannerLines = workflowBanner.slice(1,-1);

    // A compiled library that starts with the banner.
    const webLibraryLines = [...webBanner, "define([], function () {", "    return {};", "});"];
    const workflowLibraryLines = [...workflowBanner, "define([], function () {", "    return {};", "});"];

    it("gets the banner of a web library", () => {
        expect(extractBannerFromLibrary(webLibraryLines.join("\n"))).toBe(webBannerLines.join("\n"))
    });
    
    it("gets the banner of a workflow library", () => {
        expect(extractBannerFromLibrary(workflowLibraryLines.join("\n"))).toBe(workflowBannerLines.join("\n"))
    });

    it("gets the banner of a library with \\r\\n line breaks", () => {
        expect(extractBannerFromLibrary(webLibraryLines.join("\r\n"))).toBe(webBannerLines.join("\r\n"));
    });
    
    it("gets the banner of a library with \\r line breaks", () => {
        expect(extractBannerFromLibrary(workflowLibraryLines.join("\r"))).toBe(workflowBannerLines.join("\r"));
    });

    it("stops at the end of the banner", () => {
        const compiledLibrary = [...webLibraryLines, "/**", " * This is not the banner.", " */"].join("\n");

        expect(extractBannerFromLibrary(compiledLibrary)).toBe(webBannerLines.join("\n"));
    });

    it("returns undefined if the library is empty", () => {
        expect(extractBannerFromLibrary("")).toBeUndefined();
    });

    it("returns undefined if the library does not have a banner", () => {
        expect(extractBannerFromLibrary("define([], function () {});")).toBeUndefined();
    });
    
    it("returns undefined if the banner is not at the start", () => {
        expect(extractBannerFromLibrary(["define([], function () {});", ...webLibraryLines].join("\n"))).toBeUndefined();
    });
});

describe("getVersion", () => {
    it.each([
        ["web", "5.43.1"],
        ["web-sdk", "1.12.0"],
        ["sdk-library", "2.1.7"],
        ["react-ui", "21.12.3"],
    ])("gets the %s version from the web banner", (name, version) => {
        expect(getVersion(webBanner.join("/n"), name)).toBe(version);
    });

    it.each([
        ["workflow", "5.48.2"],
        ["workflow-sdk", "5.0.1"],
        ["sdk-library", "2.1.7"],
    ])("gets the %s version from the workflow banner", (name, version) => {
        expect(getVersion(workflowBanner.join("/n"), name)).toBe(version);
    });

    it("returns undefined if the banner does not contain the name", () => {
        expect(getVersion(workflowBanner.join("/n"), "react-ui")).toBeUndefined();
    });

    it("returns undefined if the environment var for the version was not set", () => {
        expect(getVersion(" * sdk-library vundefined", "sdk-library")).toBeUndefined();
    });
});

describe("renderChangelog", () => {
    it("makes a report of all changes since the built versions", () => {
        expect(renderChangelog({ sources: workflowSources, productName: "workflow" })).toBe(
            expectedReport({
                productName: "workflow", 
                since: workflowVersions, 
                changeKind: "changes", 
                grouped: false, 
                body: [
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
                ]
            })
        );
    });
    
    // react-ui 21.11.0 is older than web 5.42.0. It is in the group of web
    // 5.43.0, because the report does not include web 5.42.0.
    it("makes a report of only breaking changes since the built versions", () => {
        expect(renderChangelog({ sources: webSources, breakingOnly: true, productName: "web" })).toBe(
            expectedReport({
                productName: "web", 
                since: webVersions, 
                changeKind: "breaking changes", 
                grouped: true,
                body: [
                    "## 5.44.0 (2026-09-20)",
                    "",
                    "### Changed",
                    "",
                    "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                    "* `[web-sdk]` **Breaking:** rename the `build` argument (1.2.0)",
                    "* `[react-ui]` **Breaking:** rename the `onDismiss` prop of `Notification` to `onClose` (21.12.0)",
                    "",
                    "## 5.43.0 (2026-08-05)",
                    "",
                    "### Changed",
                    "",
                    "* `[sdk-library]` **Breaking:** remove the `foo` option (2.1.0)",
                    "",
                    "### Removed",
                    "",
                    "* `[web]` **Breaking:** remove the deprecated `menu.show` operation (5.43.0)",
                    "* `[react-ui]` **Breaking:** remove the `Hidden` component (21.11.0)",
                ]
            })
        );
    });


    it("includes all releases if the version is unknown", () => {
        // @ts-ignore
        const unknownVersion = [{ name: "web-sdk", version: undefined, markdown: webSdkChangelog }];

        expect(renderChangelog({ sources: unknownVersion, breakingOnly: true, productName: "web" })).toBe(
            expectedReport({ 
                productName: "web", 
                since: ["* `[web-sdk]`: unknown"], 
                changeKind: "breaking changes", 
                grouped: false, 
                body: [
                    "## Changed",
                    "",
                    "* `[web-sdk]` **Breaking:** rename the `build` argument (1.2.0)",
                    "* `[web-sdk]` **Breaking:** set `module` to `preserve` (1.0.0)",
                ]
            })
        );
    });

    it("does not include the release of the built version", () => {
        const latestVersion = [{ name: "web-sdk", version: "1.2.0", markdown: webSdkChangelog }];

        expect(renderChangelog({ sources: latestVersion, breakingOnly: true, productName: "web" })).toBe(
            expectedReport({ 
                productName: "web", 
                since: ["* `[web-sdk]`: 1.2.0"], 
                changeKind: "breaking changes", 
                grouped: false, 
                body: [
                    "*No breaking changes found*"
                ]
            })
        );
    });

    it("uses the start date instead of the built versions if startDate is set", () => {
        // The report includes web 5.42.0, which is the built version, because its date is the start date. The report
        // does not include react-ui 21.11.0, which is newer than the built version, because its date is before the
        // start date.
        const startDate = new Date("2026-06-20");

        expect(renderChangelog({ sources: webSources, breakingOnly: true, productName: "web", startDate })).toBe(
            expectedReport({
                productName: "web", 
                since: "2026-06-20", 
                changeKind: "breaking changes", 
                grouped: true,
                body: [
                    "## 5.44.0 (2026-09-20)",
                    "",
                    "### Changed",
                    "",
                    "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                    "* `[web-sdk]` **Breaking:** rename the `build` argument (1.2.0)",
                    "* `[react-ui]` **Breaking:** rename the `onDismiss` prop of `Notification` to `onClose` (21.12.0)",
                    "",
                    "## 5.43.0 (2026-08-05)",
                    "",
                    "### Changed",
                    "",
                    "* `[sdk-library]` **Breaking:** remove the `foo` option (2.1.0)",
                    "",
                    "### Removed",
                    "",
                    "* `[web]` **Breaking:** remove the deprecated `menu.show` operation (5.43.0)",
                    "",
                    "## 5.42.0 (2026-06-20)",
                    "",
                    "### Changed",
                    "",
                    "* `[web]` **Breaking:** require ArcGIS Maps SDK 4.33 (5.42.0)",
                ]
            })
        );
    });

    it("shows no changes if no changes are found", () => {
        // The newest release of each source built the library.
        const latestSources = [
            { name: "web", version: "5.44.0", markdown: webChangelog },
            { name: "web-sdk", version: "1.2.0", markdown: webSdkChangelog },
            { name: "sdk-library", version: "2.1.0", markdown: libraryChangelog },
            { name: "react-ui", version: "21.12.0", markdown: reactUiChangelog },
        ];

        expect(renderChangelog({ sources: latestSources, productName: "web" })).toBe(
            expectedReport({
                productName: "web",
                since: [
                    "* `[web]`: 5.44.0",
                    "* `[web-sdk]`: 1.2.0",
                    "* `[sdk-library]`: 2.1.0",
                    "* `[react-ui]`: 21.12.0",
                ],
                changeKind: "changes",
                grouped: false,
                body: ["*No changes found*"],
            })
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
        const sources = [{ name: "web-sdk", version: "1.0.0", markdown }];

        expect(renderChangelog({ sources, breakingOnly: true, productName: "web" })).toBe(
            expectedReport({
                productName: "web", 
                since: ["* `[web-sdk]`: 1.0.0"], 
                changeKind: "breaking changes", 
                grouped: false,
                body: [
                    "## Changed",
                    "",
                    "* `[web-sdk]` **Breaking:** rename the `build` argument (1.1.0)",
                ]
            })
        );
    });

    it("shows a release that has no breaking changes", () => {
        expect(renderChangelog({ sources: [nextWebVersions], breakingOnly: true, productName: "web" })).toBe(
            expectedReport({
                productName: "web", 
                since: ["* `[web]`: 5.43.0"], 
                changeKind: "breaking changes", 
                grouped: true,
                body: [
                    "## 5.45.0 (2026-10-01)",
                    "",
                    "*No breaking changes found*",
                    "",
                    "## 5.44.0 (2026-09-20)",
                    "",
                    "### Changed",
                    "",
                    "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                ]
            })
        );
    });

    it("puts changes after the newest product release in a separate group if they are not from dependencies", () => {
        const library = {
            name: "sdk-library",
            version: "2.0.0",
            markdown: makeRelease("2.1.0", "2026-10-10", [
                "### Changed",
                "",
                "- **Breaking:** remove the `foo` option",
            ]),
        };

        expect(renderChangelog({ sources: [nextWebVersions, library], productName: "web" })).toBe(
            expectedReport({
            productName: "web", 
                since: ["* `[web]`: 5.43.0", "* `[sdk-library]`: 2.0.0"], 
                changeKind: "changes", 
                grouped: true,
                body: [
                    "## Post 5.45.0",
                    "",
                    "### Changed",
                    "",
                    "* `[sdk-library]` **Breaking:** remove the `foo` option (2.1.0)",
                    "",
                    "## 5.45.0 (2026-10-01)",
                    "",
                    "### Added",
                    "",
                    "* `[web]` Add the `zoom` command (5.45.0)",
                    "",
                    "## 5.44.0 (2026-09-20)",
                    "",
                    "### Changed",
                    "",
                    "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                ]
            })
        );
    });

    it("does not put changes after the newest product release in a separate group if they are from dependencies", () => {
        // Web 5.45.0 depends on react-ui 21.11.0. Thus, no Web release includes react-ui 21.12.0, and the report
        // does not include it.
        const reactUi = {
            name: "react-ui",
            version: "21.11.0",
            markdown: makeRelease("21.12.0", "2026-10-10", [
                "### Changed",
                "",
                "- **Breaking:** rename the `onDismiss` prop of `Notification` to `onClose`",
            ]),
        };
        const dependencyVersions = { "react-ui": { "5.44.0": "21.11.0", "5.45.0": "21.11.0" } };

        expect(renderChangelog({ sources: [nextWebVersions, reactUi], productName: "web", dependencyVersions })).toBe(
            expectedReport({
                productName: "web",
                since: ["* `[web]`: 5.43.0", "* `[react-ui]`: 21.11.0"],
                changeKind: "changes",
                grouped: true,
                body: [
                    "## 5.45.0 (2026-10-01)",
                    "",
                    "### Added",
                    "",
                    "* `[web]` Add the `zoom` command (5.45.0)",
                    "",
                    "## 5.44.0 (2026-09-20)",
                    "",
                    "### Changed",
                    "",
                    "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                ],
            })
        );
    });

    it("leaves out the react-ui changes that the newest web release does not include", () => {
        // Web 5.45.0 depends on react-ui 21.12.0. Thus, no Web release includes react-ui 21.13.0, although react-ui
        // 21.13.0 was released before web 5.45.0.
        const reactUi = {
            name: "react-ui",
            version: "21.11.0",
            markdown: [
                makeRelease("21.13.0", "2026-09-28", ["### Added", "", "- Add the `Carousel` component"]),
                makeRelease("21.12.0", "2026-09-24", ["### Fixed", "", "- Fix the focus ring of `IconButton`"]),
            ].join("\n\n"),
        };
        const dependencyVersions = { "react-ui": { "5.44.0": "21.11.0", "5.45.0": "21.12.0" } };

        expect(renderChangelog({ sources: [nextWebVersions, reactUi], productName: "web", dependencyVersions })).toBe(
            expectedReport({
                productName: "web",
                since: ["* `[web]`: 5.43.0", "* `[react-ui]`: 21.11.0"],
                changeKind: "changes",
                grouped: true,
                body: [
                    "## 5.45.0 (2026-10-01)",
                    "",
                    "### Added",
                    "",
                    "* `[web]` Add the `zoom` command (5.45.0)",
                    "",
                    "### Fixed",
                    "",
                    "* `[react-ui]` Fix the focus ring of `IconButton` (21.12.0)",
                    "",
                    "## 5.44.0 (2026-09-20)",
                    "",
                    "### Changed",
                    "",
                    "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                ],
            })
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

        expect(renderChangelog({ sources: [nextWebVersions, webSdk], productName: "web" })).toBe(
            expectedReport({
                productName: "web", 
                since: ["* `[web]`: 5.43.0", "* `[web-sdk]`: 1.0.0"], 
                changeKind: "changes", 
                grouped: true,
                body: [
                    "## 5.45.0 (2026-10-01)",
                    "",
                    "### Added",
                    "",
                    "* `[web]` Add the `zoom` command (5.45.0)",
                    "",
                    "## 5.44.0 (2026-09-20)",
                    "",
                    "### Changed",
                    "",
                    "* `[web]` **Breaking:** rename the `results.display` command (5.44.0)",
                    "* `[web-sdk]` **Breaking:** rename the `build` argument (1.1.0)",
                ]
            })
        );
    });

});