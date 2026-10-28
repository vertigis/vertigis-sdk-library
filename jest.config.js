const esmPackages = [
    "character-entities",
    "decode-named-character-reference",
    "devlop",
    "longest-streak",
    "mdast-util-[^/]+",
    "micromark[^/]*",
    "unist-util-[^/]+",
    "zwitch",
];

export default {
    testEnvironment: "node",
    transform: {
        "^.+\\.(js|jsx|ts|tsx)$": ["@swc/jest"],
    },
    transformIgnorePatterns: [`/node_modules/(?!(${esmPackages.join("|")})/)`],
};
