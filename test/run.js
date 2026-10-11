/**
 * Runs node:test suites with the env vars they need, without relying on the npm script shell.
 *
 *   node test/run.js                     unit suites against freshly copied types
 *   node test/run.js --update-baseline   rewrite test/baselines/*.json
 */
const { spawnSync } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const env = { ...process.env };
const files = ["test/*.test.js"];

if (args.includes("--update-baseline")) env.UPDATE_BASELINE = "1";

const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: path.join(__dirname, ".."),
    env,
    stdio: "inherit",
});
process.exit(result.status === null ? 1 : result.status);
