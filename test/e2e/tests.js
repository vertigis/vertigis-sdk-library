// @ts-check
"use strict";

import { execa } from "execa";
import { strict as assert } from "assert";
import fetch from "node-fetch";
import * as fs from "fs";
import https from "https";
import path from "path";
import { chromium } from "playwright-chromium";
import pRetry from "p-retry";
import { pathToFileURL } from "url";

/**
 * The tests in this file are called by the individual SDK repos after setting
 * appropriate environment variables:
 *
 *   process.env.OPEN_BROWSER = "false";
 *
 *   process.env.SDK_LOCAL_DEV = "true";
 *
 *   process.env.ROOT_DIRECTORY = Root folder of the SDK instance calling the
 *   tests.
 *
 *   process.env.TEST_PROJECT_PATH = The path the test project is installed at:
 *   ROOT_DIRECTORY/test-lib
 *
 *   process.env.UPGRADE_PROJECTS_PATH = The path to the folder containing
 *   upgradeable projects to test.
 *
 *   process.env.SMOKE_TEST = "true";
 *
 *   process.env.SDK_PLATFORM = Either "web" or "workflow";
 *
 */

/** @type {import("execa").ResultPromise} */
let subprocess;

let success = false;

/** @returns {Promise<string>} */
async function getProjectUuid() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (await import(pathToFileURL(path.join(process.env.TEST_PROJECT_PATH, "uuid.cjs")).href))
        .default;
}

/**
 * @param {Array<string>} args
 * @param {import("execa").Options} [opts]
 */
function runNpmScript(args, opts) {
    console.log(`\nExecuting ${process.env.SDK_PLATFORM}-sdk CLI script: ${args.join(" ")}\n`);
    const scriptProcess = execa(
        path.join(process.env.ROOT_DIRECTORY, `bin/vertigis-${process.env.SDK_PLATFORM}-sdk.js`),
        args,
        opts
    );

    // Pipe process output to current process output so it is visible in the
    // console, but still allows us to examine the subprocess stdout/stderr
    // variables.
    scriptProcess.stdout?.pipe(process.stdout);
    scriptProcess.stderr?.pipe(process.stderr);

    // Set data encoding to be a string instead of Buffer objects.
    scriptProcess.stdout?.setEncoding("utf8");
    scriptProcess.stderr?.setEncoding("utf8");

    return scriptProcess;
}

function killSubprocess() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    if (subprocess && !subprocess.killed) {
        subprocess.kill();
        subprocess = undefined;
    }
}

/**
 *
 * @param {import("execa").ResultPromise<import("execa").Options>} subprocess
 */
async function awaitSubprocess(subprocess) {
    try {
        await subprocess;
    } catch (error) {
        if (!success) {
            throw error;
        }
    }
}

async function testCreateProject() {
    // First try creating the project.
    subprocess = runNpmScript(["create", process.env.TEST_PROJECT_PATH]);
    await subprocess;

    // Try to create same named project again.
    subprocess = runNpmScript(["create", process.env.TEST_PROJECT_PATH], { reject: false });
    const processResult = await subprocess;
    assert.strictEqual(
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        processResult.stderr
            .toString()
            .includes(
                `Cannot create new project at ${process.env.TEST_PROJECT_PATH} as it already exists`
            ),
        true,
        "Failed to detect existing directory"
    );

    if (process.env.SDK_PLATFORM === "workflow") {
        const projectUuid = await getProjectUuid();
        assert.strictEqual(projectUuid.length, 36, "Create project should populate uuid");
    }
}

// We assume the project was successfully created to run the following tests.
async function testBuildProject() {
    subprocess = runNpmScript(["build"], { cwd: process.env.TEST_PROJECT_PATH });
    await subprocess;
    assert.strictEqual(
        fs.existsSync(path.join(process.env.TEST_PROJECT_PATH, "build/main.js")),
        true,
        "build/main.js is missing"
    );
    assert.strictEqual(
        fs
            .readFileSync(path.join(process.env.TEST_PROJECT_PATH, "build/main.js"), "utf-8")
            .includes("define("),
        true,
        "main.js should be an AMD module (build)"
    );
}

async function testGenerate() {
    const cleanStdoutData = (/** @type {string} */ data) =>
        data
            // Remove ansi escape sequences.
            .replace(/\p{C}\[[0-9hlmGK?]+\s*/gu, "")
            .trim();

    const createDataCallback =
        (/** @type {{ endsWith: string; write: string; matched?: boolean; }[]} */ matches) =>
        (/** @type {string} */ data) => {
            const cleanData = cleanStdoutData(data);

            for (const match of matches) {
                if (!match.matched && cleanData.endsWith(match.endsWith)) {
                    subprocess.stdin.write(match.write);
                    // Because of the nature of inquirer clearing and reprinting
                    // lines in the console, we can receive data events that end
                    // with the same match. Make sure we only write to stdin once.
                    match.matched = true;
                    return;
                }
            }
        };

    // Test create activity
    console.log("running generate");
    subprocess = runNpmScript(["generate"], { cwd: process.env.TEST_PROJECT_PATH });
    subprocess.stdout.on(
        "data",
        createDataCallback([
            // Being asked about what we'd like to create (activity or form element)
            {
                endsWith: "Form Element",
                // Hit enter on default selected item (activity)
                write: "\n",
            },
            {
                endsWith: "What is the activity name",
                write: "FooName\n",
            },
            {
                endsWith: "What is the description",
                write: "FooName description\n",
            },
        ])
    );

    await subprocess;

    await pRetry(
        () => {
            assert.strictEqual(
                fs.existsSync(
                    path.join(process.env.TEST_PROJECT_PATH, "src/activities/FooName.ts")
                ),
                true,
                "Generate activity should create activity module"
            );
            assert.strictEqual(
                fs
                    .readFileSync(path.join(process.env.TEST_PROJECT_PATH, "src/index.ts"), "utf-8")
                    .includes('export { default as FooNameActivity } from "./activities/FooName";'),
                true,
                "Generate activity should update index.ts exports"
            );
            assert.strictEqual(
                fs
                    .readFileSync(path.join(process.env.TEST_PROJECT_PATH, "src/index.ts"), "utf-8")
                    .includes("export default {};"),
                false,
                "Generate activity should remove placeholder export in index.ts"
            );

            const activityContent = fs.readFileSync(
                path.join(process.env.TEST_PROJECT_PATH, "src/activities/FooName.ts"),
                "utf-8"
            );

            const activityContentAssertions = [
                "interface FooNameInputs {",
                "interface FooNameOutputs {",
                "* @displayName FooName",
                "* @description FooName description",
                "export default class FooNameActivity implements IActivityHandler {",
                "execute(inputs: FooNameInputs): FooNameOutputs {",
            ];

            for (const assertion of activityContentAssertions) {
                assert.strictEqual(
                    activityContent.includes(assertion),
                    true,
                    `Expected content "${assertion}" in activity`
                );
            }
        },
        {
            maxRetryTime: 2000,
        }
    );

    // Test create form element
    subprocess = runNpmScript(["generate"], { cwd: process.env.TEST_PROJECT_PATH });
    subprocess.stdout.on(
        "data",
        createDataCallback([
            // Being asked about what we'd like to create (activity or form element)
            {
                endsWith: "Form Element",
                // Down arrow + enter (select form element option)
                write: "\u001b[B\n",
            },
            {
                endsWith: "What is the element name",
                write: "BarName\n",
            },
            {
                endsWith: "What is the description",
                write: "BarName description\n",
            },
        ])
    );

    await pRetry(
        () => {
            assert.strictEqual(
                fs.existsSync(path.join(process.env.TEST_PROJECT_PATH, "src/elements/BarName.tsx")),
                true,
                "Generate element should create element module"
            );
            assert.strictEqual(
                fs
                    .readFileSync(path.join(process.env.TEST_PROJECT_PATH, "src/index.ts"), "utf-8")
                    .includes(
                        'export { default as BarNameRegistration } from "./elements/BarName";'
                    ),
                true,
                "Generate element should update index.ts exports"
            );

            const elementContent = fs.readFileSync(
                path.join(process.env.TEST_PROJECT_PATH, "src/elements/BarName.tsx"),
                "utf-8"
            );

            const elementContentAssertions = [
                "interface BarNameProps extends FormElementProps<string> {}",
                "* @displayName BarName",
                "* @description BarName description",
                "function BarName(props: BarNameProps): React.ReactElement",
                "const BarNameElementRegistration: FormElementRegistration<BarNameProps>",
                "component: BarName",
                'id: "BarName"',
                "export default BarNameElementRegistration",
            ];

            for (const assertion of elementContentAssertions) {
                assert.strictEqual(
                    elementContent.includes(assertion),
                    true,
                    `Expected content "${assertion}" in element`
                );
            }
        },
        {
            maxRetryTime: 2000,
        }
    );
}

async function testActivityPackMetadataGeneration() {
    const metadataPath = path.join(process.env.TEST_PROJECT_PATH, "build/activitypack.json");

    assert.strictEqual(fs.existsSync(metadataPath), true, "build/activitypack.json");

    const projectUuid = await getProjectUuid();
    const metadata = JSON.parse(
        JSON.stringify(await import(pathToFileURL(metadataPath).href, { with: { type: "json" } }))
    );

    assert.deepStrictEqual(metadata?.default, {
        activities: [
            {
                action: `uuid:${projectUuid}::FooNameActivity`,
                category: "Custom Activities",
                description: "FooName description",
                displayName: "FooName",
                inputs: {
                    input1: {
                        description: "The first input to the activity.",
                        displayName: "Input 1",
                        isRequired: true,
                        name: "input1",
                        typeName: "string",
                    },
                    input2: {
                        description: "The second input to the activity.",
                        displayName: "Input 2",
                        name: "input2",
                        typeName: "number",
                    },
                },
                outputs: {
                    result: {
                        description: "The result of the activity.",
                        displayName: "Result",
                        name: "result",
                        typeName: "string",
                    },
                },
                suite: `uuid:${projectUuid}`,
            },
        ],
        elements: [
            {
                description: "BarName description",
                displayName: "BarName",
                id: "BarName",
                inputs: {},
                suite: `uuid:${projectUuid}`,
            },
        ],
    });
}

async function testStartProject() {
    subprocess = runNpmScript(["start"], { cwd: process.env.TEST_PROJECT_PATH });

    // Wait for webpack-dev-server to start. It can take some time!
    await new Promise(resolve => {
        subprocess.stdout.on("data", (/** @type {string} */ data) => {
            // If compilation is going to fail we should have exited the tests
            // already at the build step.
            if (data.includes("No errors found.")) {
                resolve();
            }
        });
    });

    const testStartWorkflow = async () => {
        // The dev server uses a self signed cert which the `https` module won't allow by default.
        const unsafeAgent = new https.Agent({ rejectUnauthorized: false });

        await pRetry(async () => {
            let response;
            try {
                response = await fetch("https://localhost:5000/main.js", {
                    agent: unsafeAgent,
                });
            } catch {
                assert.fail();
            }
            assert.strictEqual(
                (await response?.text())?.includes("define("),
                true,
                "main.js should be an AMD module (start)"
            );
        });
    };

    const testStartWeb = async () => {
        await pRetry(async () => {
            const browser = await chromium.launch();
            try {
                const page = await browser.newPage();
                await page.goto("http://localhost:3001");
                const frame = page.frame("viewer");
                await frame?.waitForSelector("text=Points of Interest");
            } catch {
                assert.fail();
            } finally {
                await browser.close();
            }
        });
    };

    await (process.env.SDK_PLATFORM === "web" ? testStartWeb : testStartWorkflow)();

    // Killing this subprocess and shutting down the server will throw an error,
    // so make sure it gets handled.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    awaitSubprocess(subprocess);
}

async function testUpgradeProject() {
    // Copy the project to upgrade to a temp location.
    const originalProjectPath = path.join(process.env.UPGRADE_PROJECTS_PATH, (process.env.SDK_PLATFORM === "web" ? "web-1.11.1" : "workflow-5.1.2"));
    const projectPath = path.join(process.env.ROOT_DIRECTORY, "upgrade");
    await fs.promises.cp(originalProjectPath, projectPath, { recursive: true });

    // Determine the version of packages we should be upgrading to.
    const responses = await Promise.all([
        fetch(`https://registry.npmjs.com/@vertigis/${process.env.SDK_PLATFORM}/`),
        fetch(`https://registry.npmjs.com/@vertigis/${process.env.SDK_PLATFORM}-sdk/`),
    ]);
    const [productInfo, sdkInfo] = await Promise.all(responses.map(r => r.json()));
    // @ts-ignore
    const latestProduct = productInfo["dist-tags"]?.latest;
    // @ts-ignore
    const latestSDK = sdkInfo["dist-tags"]?.latest;

    // Run the upgrade script.
    subprocess = runNpmScript(["upgrade", process.env.ROOT_DIRECTORY], {cwd: projectPath});
    await subprocess;

    // Read the package.json file after upgrading.
    const projectPackage = JSON.parse(await fs.promises.readFile(path.join(projectPath, "package.json"), "utf8"));

    assert.strictEqual(
        projectPackage.devDependencies[`@vertigis/${process.env.SDK_PLATFORM}`], 
        `^${latestProduct}`,
        `Base ${process.env.SDK_PLATFORM} package should be upgraded to version ${latestProduct}`
    );
    
    assert.strictEqual(
        projectPackage.devDependencies[`@vertigis/${process.env.SDK_PLATFORM}-sdk`], 
        `^${latestSDK}`,
        `SDK package for ${process.env.SDK_PLATFORM} should be upgraded to version ${latestSDK}`
    );

    assert.strictEqual(
        fs.existsSync(path.join(projectPath, "eslint.config.js")),
        true,
        "New ESlint configuration should be added."
    );

    assert.strictEqual(
        projectPackage.type,
        "module",
        "Project type should be set to 'module'."
    );

    fs.rmSync(projectPath, { recursive: true })
}

function cleanup() {
    console.log("\nCleaning up test folder and killing subprocess...");
    killSubprocess();
    fs.rmSync(process.env.TEST_PROJECT_PATH, { recursive: true });
    console.log("Done cleaning.");
}

try {
    await testUpgradeProject();
    await testCreateProject();
    await testBuildProject();

    if (process.env.SDK_PLATFORM === "workflow") {
        await testGenerate();
        await testBuildProject();
        await testActivityPackMetadataGeneration();
    }

    await testStartProject();

    success = true;
    console.log("\n\nAll tests passed!\n");
} catch (error) {
    console.error("\n\nTest failed.\n");
    console.error(error);
    cleanup();
    process.exit(1);
}

try {
    cleanup();
} catch {
    console.error(
        "\n\nFailed to clean up. You may need to remove the 'test-lib' directory manually.\n"
    );
}
