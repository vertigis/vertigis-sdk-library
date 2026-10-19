// @ts-check
"use strict";

import { fromMarkdown } from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";
import {
    changeItemComparer,
    getChangelogEntriesByVersion,
    getChangelogFiles,
    getSoftwareVersions,
} from "../lib/shared/changelogUtils.js";

/**
 * SDK project changelog script.
 *
 * @param {string} sourceDir
 * @param {string} scriptHeader
 * @param {boolean} breakingOnly
 * @param {"web" | "workflow" | string} projectType
 *
 * @returns {Promise<string>}
 */
const changelog = async (sourceDir, scriptHeader, breakingOnly = true, projectType = process.env.SDK_PLATFORM) => {
    const [productVersion, sdkVersion, libraryVersion, reactUiVersion] = getSoftwareVersions(scriptHeader, projectType);

    const [productChangelog, sdkChangelog, libraryChangelog, uiChangelog] = await getChangelogFiles(
        sourceDir,
        projectType
    );

    const productTree = fromMarkdown(productChangelog);
    const sdkTree = fromMarkdown(sdkChangelog);
    const libraryTree = fromMarkdown(libraryChangelog);
    const uiTree = fromMarkdown(uiChangelog);

    const productEntriesByVersion = getChangelogEntriesByVersion(productVersion, projectType, productTree, breakingOnly);
    const sdkEntriesByVersion = getChangelogEntriesByVersion(sdkVersion, `${projectType}-sdk`, sdkTree, breakingOnly);
    const libraryEntriesByVersion = getChangelogEntriesByVersion(libraryVersion, "sdk-library", libraryTree, breakingOnly);
    const uiEntriesByVersion = getChangelogEntriesByVersion(reactUiVersion, "react-ui", uiTree, breakingOnly);

    /**
     * @type {import("mdast").RootContent[]}
     */
    const messages = [
        {
            type: "paragraph",
            children: [
                {
                    type: "text",
                    value: "The target library was built with the following software versions:"
                }
            ]
        },
        {
            type: "list",
            children: [
                {
                    type: "listItem",
                    children: [
                        {   
                            type: "paragraph",
                            children: [
                                {
                                    type: "inlineCode",
                                    value: `[${projectType}]:`
                                },
                                {
                                    type: "text",
                                    value: ` ${productVersion ?? "Unknown"}`
                                }
                            ]
                        },
                        {   
                            type: "paragraph",
                            children: [
                                {
                                    type: "inlineCode",
                                    value: `[${projectType}-sdk]:`
                                },
                                {
                                    type: "text",
                                    value: ` ${sdkVersion ?? "Unknown"}`
                                }
                            ]
                        },
                        {   
                            type: "paragraph",
                            children: [
                                {
                                    type: "inlineCode",
                                    value: "[sdk-library]: "
                                },
                                {
                                    type: "text",
                                    value: ` ${libraryVersion ?? "Unknown"}`
                                }
                            ]
                        },
                        {   
                            type: "paragraph",
                            children: [
                                {
                                    type: "inlineCode",
                                    value: "[react-ui]: "
                                },
                                {
                                    type: "text",
                                    value: ` ${reactUiVersion ?? "Unknown"}`
                                }
                            ]
                        },
                    ]
                }
            ]
        },
        {
            type: "paragraph",
            children: [
                {
                    type: "text",
                    value: `Please examine the following ${breakingOnly ? "breaking changes" : "changes"} carefully for ones that affect your project. For software with an unknown version all changes have been included.`
                }
            ]
        },
    ];


    const allChangeItems = [
        ...productEntriesByVersion.change,
        ...sdkEntriesByVersion.change,
        ...libraryEntriesByVersion.change,
        ...uiEntriesByVersion.change,
    ].sort(changeItemComparer);

    const allAddItems = [
        ...productEntriesByVersion.add,
        ...sdkEntriesByVersion.add,
        ...libraryEntriesByVersion.add,
        ...uiEntriesByVersion.add,
    ].sort(changeItemComparer);

    const allRemoveItems = [
        ...productEntriesByVersion.remove,
        ...sdkEntriesByVersion.remove,
        ...libraryEntriesByVersion.remove,
        ...uiEntriesByVersion.remove,
    ].sort(changeItemComparer);

    const allFixItems = [
        ...productEntriesByVersion.fix,
        ...sdkEntriesByVersion.fix,
        ...libraryEntriesByVersion.fix,
        ...uiEntriesByVersion.fix,
    ].sort(changeItemComparer);

    /**
     * @type {import("mdast").RootContent[]}
     */
    const treeChildren = [
        {
            type: "heading",
            depth: 1,
            children: [
                {
                    type: "text",
                    value: "Changelog",
                },
            ],
        },
        ...messages,
        allChangeItems.length > 0
            ? {
                  type: "heading",
                  depth: 2,
                  children: [
                      {
                          type: "text",
                          value: "Changed",
                      },
                  ],
              }
            : undefined,
        ...allChangeItems.map(change => change.item),
        allAddItems.length > 0
            ? {
                  type: "heading",
                  depth: 2,
                  children: [
                      {
                          type: "text",
                          value: "Added",
                      },
                  ],
              }
            : undefined,
        ...allAddItems.map(add => add.item),
        allRemoveItems.length > 0
            ? {
                  type: "heading",
                  depth: 2,
                  children: [
                      {
                          type: "text",
                          value: "Removed",
                      },
                  ],
              }
            : undefined,
        ...allRemoveItems.map(remove => remove.item),
        allFixItems.length > 0
            ? {
                  type: "heading",
                  depth: 2,
                  children: [
                      {
                          type: "text",
                          value: "Fixed",
                      },
                  ],
              }
            : undefined,
        ...allFixItems.map(fix => fix.item),
    ];

    /**
     * @type {import("mdast").Root}
     */
    const outputTree = {
        type: "root",
        children: treeChildren.filter(child => child !== undefined),
    };

    return toMarkdown(outputTree);
};

export default changelog;
