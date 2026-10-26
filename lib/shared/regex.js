// @ts-check
"use strict";

// Regexes and related utilities.

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
