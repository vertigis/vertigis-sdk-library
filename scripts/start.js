// @ts-check
"use strict";

import * as http from "http";
import * as https from "https";
import webpack from "webpack";
import { merge } from "webpack-merge";
import WebpackDevServer from "webpack-dev-server";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import paths from "../config/paths.js";

/**
 * @param {webpack.Configuration} webpackConfig
 * @param {"web" | "workflow"} projectType
 */
const start = (webpackConfig, projectType) => {
    /** @type {Record<string, string>} */
    // @ts-ignore
    const argv = yargs(hideBin(process.argv)).argv;
    const isWeb = projectType === "web";
    const port = argv["port"] ?? process.env.PORT ?? (isWeb ? 3001 : 5000);
    // Set this to 0.0.0.0 to allow binding to any host.
    const host = argv["host"] ?? "localhost";
    const serverType = argv["type"] ?? (host === "localhost" ? "http" : "https");
    const compiler = webpack(webpackConfig);

    /**
     * @type { WebpackDevServer.Configuration }
     */
    const serverConfig = {
        allowedHosts: argv["allowed-hosts"] ?? "all",
        client: {
            logging: "none",
            webSocketURL: {
                port: process.env.SOCK_PORT || undefined,
            },
        },
        compress: true,
        headers: {
            "Access-Control-Allow-Origin": "*",
        },
        host,
        hot: isWeb,
        open:
            process.env.SMOKE_TEST !== "true" &&
            process.env.OPEN_BROWSER !== "false" &&
            (isWeb
                ? `${serverType}://${host}:${port}${process.env.OPEN_PAGE || ""}`
                : { target: ["main.js"] }),
        port,
        server: {
            type: serverType,
            options: {
                // @ts-ignore
                key: argv["key"],
                // @ts-ignore
                cert: argv["cert"],
                // @ts-ignore
                ca: argv["ca"],
            },
        },
        static: {
            publicPath: isWeb ? undefined : "/",
            directory: isWeb ? paths.projPublicDir : undefined,
            watch: {
                ignored: [/node_modules/],
            },
        },
    };

    // Proxy configuration for Web
    if (projectType === "web") {
        const viewerTarget = process.env.VIEWER_URL || "https://apps.vertigisstudio.com/web";
        serverConfig.proxy = [
            {
                path: "/viewer",
                target: viewerTarget,
                agent: viewerTarget.startsWith("https")
                    ? new https.Agent({ keepAlive: true })
                    : new http.Agent({ keepAlive: true }),
                changeOrigin: true,
                logLevel: "warn",
                pathRewrite: {
                    // Strip /viewer from path so it isn't forwarded to the target
                    // /viewer/index.html => /index.html => https://apps.vertigisstudio.com/web/index.html
                    "^/viewer": "",
                },
            },
        ];
    }

    const mergedConfig = merge(serverConfig, webpackConfig.devServer ?? {});
    const devServer = new WebpackDevServer(mergedConfig, compiler);

    devServer.startCallback(err => {
        if (err) {
            throw err;
        }
    });

    ["SIGINT", "SIGTERM"].forEach(signal => {
        process.on(signal, () => {
            devServer.stopCallback(() => {
                process.exit();
            });
        });
    });
};

export default start;
