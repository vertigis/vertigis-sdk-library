// @ts-check
"use strict";

// Utilities for assembling markdown documents from mdast objects

/**
 * @param {string} value
 *
 * @returns {import("mdast").Text}
 */
export const text = value => ({ type: "text", value });

/**
 * @param {string} value
 *
 * @returns {import("mdast").InlineCode}
 */
export const inlineCode = value => ({ type: "inlineCode", value });

/**
 * @param {...import("mdast").PhrasingContent} children
 *
 * @returns {import("mdast").Emphasis}
 */
export const emphasis = (...children) => ({ type: "emphasis", children });

/**
 * @param {...import("mdast").PhrasingContent} children
 *
 * @returns {import("mdast").Paragraph}
 */
export const paragraph = (...children) => ({ type: "paragraph", children });

/**
 * @param {import("mdast").Heading["depth"]} depth
 * @param {string} value
 *
 * @returns {import("mdast").Heading}
 */
export const heading = (depth, value) => ({ type: "heading", depth, children: [text(value)] });

/**
 * @param {import("mdast").ListItem[]} items
 *
 * @returns {import("mdast").List}
 */
export const list = items => ({ type: "list", spread: false, children: items });

/**
 * @param {...(import("mdast").BlockContent | import("mdast").DefinitionContent)} children
 *
 * @returns {import("mdast").ListItem}
 */
export const listItem = (...children) => ({ type: "listItem", children });

/**
 * @param {...import("mdast").RootContent} children
 *
 * @returns {import("mdast").Root}
 */
export const root = (...children) => ({ type: "root", children });