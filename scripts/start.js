// @ts-check
"use strict";

import * as http from "http";
import * as https from "https";
import webpack from "webpack";
import WebpackDevServer from "webpack-dev-server";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import paths from "../config/paths.js";

/**
 *
 * @param {webpack.Configuration} webpackConfig
 * @param {"web" | "workflow"} projectType
 */
const start = (webpackConfig, projectType) => {
    /** @type {Record<string, string>} */
    // @ts-ignore
    const argv = yargs(hideBin(process.argv)).argv;

    const isWeb = projectType === "web";
    const httpAgent = new http.Agent({ keepAlive: true });
    const httpsAgent = new https.Agent({ keepAlive: true });
    const port = process.env.PORT ?? (isWeb ? 3001 : 5000);
    const viewerTarget = process.env.VIEWER_URL || "https://apps.vertigisstudio.com/web";
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
        // Set this to 0.0.0.0 to allow binding to any host.
        host: argv["host"] ?? "localhost",
        hot: isWeb,
        open:
            process.env.SMOKE_TEST !== "true" &&
            process.env.OPEN_BROWSER !== "false" &&
            (isWeb
                ? `http://localhost:${port}${process.env.OPEN_PAGE || ""}`
                : { target: ["main.js"] }),
        port,
        static: {
            publicPath: isWeb ?  undefined : "/",
            directory: isWeb ? paths.projPublicDir : undefined,
            watch: {
                ignored: [/node_modules/],
            },
        },
    };

    // Proxy configuration for Web
    if (projectType === "web") {
        serverConfig.proxy = [
            {
                path: "/viewer",
                target: viewerTarget,
                agent: viewerTarget.startsWith("https") ? httpsAgent : httpAgent,
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

    // HTTPS server configuration for Workflow
    if (projectType === "workflow") {
        const argv = yargs(hideBin(process.argv)).parseSync();
        serverConfig.server = {
            type: "https",
            options: {
                // @ts-ignore
                key: argv["key"],
                // @ts-ignore
                cert: argv["cert"],
                // @ts-ignore
                ca: argv["ca"],
            },
        };
    }

    const devServer = new WebpackDevServer(serverConfig, compiler);

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
