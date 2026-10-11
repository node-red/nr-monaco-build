/**
 * Runs node:test suites with the env vars they need, without relying on the npm script shell.
 *
 *   node test/run.js                     unit suites against freshly copied types
 *   node test/run.js --update-baseline   rewrite test/baselines/*.json
 *   node test/run.js --output            also check the existing build in output/
 *   node test/run.js --node-red-sync     compare with node-red (see test/node-red-sync/)
 */
const { spawnSync } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const env = { ...process.env };
const files = ["test/*.test.js"];

if (args.includes("--update-baseline")) env.UPDATE_BASELINE = "1";
if (args.includes("--output")) {
    env.NR_MONACO_TYPES_DIR = path.join(__dirname, "..", "output", "types");
    files.push("test/build-output/*.test.js");
}
if (args.includes("--node-red-sync")) files.splice(0, files.length, "test/node-red-sync/*.test.js");

const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: path.join(__dirname, ".."),
    env,
    stdio: "inherit",
});
process.exit(result.status === null ? 1 : result.status);
