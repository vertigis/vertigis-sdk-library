// @ts-check
"use strict";
import * as crypto from "crypto";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";
import webpack from "webpack";

import paths from "./paths.js";

const isEnvProduction = process.env.NODE_ENV === "production";

// Generate random identifier to ensure uniqueness in the application. This is
// especially important to avoid collisions when multiple webpack runtimes are
// in the same document, such as Web's runtime and this library's runtime.
const libId = crypto.randomBytes(8).toString("hex");

/**
 * A base webpack configuration designed to build a library as a single amd file.
 * @type { webpack.Configuration }
 */
const baseConfig = {
    mode: isEnvProduction ? "production" : "development",
    context: paths.projRoot,
    devtool: isEnvProduction ? false : (process.env.DEV_TOOL ?? "inline-source-map"),
    // Disable perf hints as it's mostly out of the developer's control as we
    // only allow one chunk.
    performance: false,
    resolve: {
        extensions: paths.moduleFileExtensions,
    },
    entry: paths.projEntry,
    output: {
        // Technically this shouldn't be needed as we restrict the library to
        // one chunk, but we set this here just to be extra safe against
        // collisions.
        chunkLoadingGlobal: libId,
        libraryTarget: "amd",
        publicPath: "/",
        path: isEnvProduction ? paths.projBuild : undefined,
        // There will be one main bundle, and one file per asynchronous chunk.
        // In development, it does not produce real files.
        filename: "[name].js",
    },
    module: {
        parser: {
            javascript: {
                exportsPresence: "error",
            },
        },
        rules: [
            // Embeds assets smaller than the specified limit (Infinity
            // in our case) as data URLs.
            {
                test: /\.(png|jpe?g|gif|svg|eot|ttf|woff|woff2)$/i,
                loader: "url-loader",
            },
            // Process application JS with Babel.
            // The preset includes JSX, Flow, TypeScript, and some ESnext features.
            {
                test: /\.(js|jsx|ts|tsx)$/i,
                include: paths.projSrc,
                loader: "ts-loader",
                options: {
                    context: paths.projRoot,
                    transpileOnly: true,
                },
            },
            {
                test: /\.css$/i,
                sideEffects: true,
                use: [
                    {
                        loader: "style-loader",
                    },
                    {
                        loader: "css-loader",
                        options: {
                            // How many loaders before "css-loader" should be applied to "@import"ed resources
                            importLoaders: 1,
                        },
                    },
                    {
                        // Adds vendor prefixing based on your specified browser support in
                        // package.json
                        loader: "postcss-loader",
                        options: {
                            postcssOptions: {
                                plugins: ["postcss-preset-env"],
                            },
                        },
                    },
                ],
            },
        ],
    },
    plugins: [
        // Define process.env variables that should be made available in source code.
        new webpack.DefinePlugin({
            "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
        }),
        new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
        new ForkTsCheckerWebpackPlugin(),
    ],
    watchOptions: {
        // Don't bother watching node_modules files for changes. This reduces
        // CPU/mem overhead, but means that changes from `npm install` while the
        // dev server is running won't take effect until restarted.
        ignored: /node_modules/,
    },
};

export default baseConfig;
