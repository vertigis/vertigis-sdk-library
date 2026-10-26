// @ts-check
"use strict";

import { it, expect, describe } from "@jest/globals";
import { isIsoDate, extractBannerFromLibrary } from "../../lib/shared/regex";

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