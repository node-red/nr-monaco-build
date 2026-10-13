/**
 * Where the tests find the generated types.
 *
 * By default the real copy step from update-types.js runs against the installed
 * `@types/node` and `node-red-types/`, into a temp folder. That needs no network and no prior
 * build. Set NR_MONACO_TYPES_DIR (e.g. to `output/types`) to test an existing build instead;
 * `npm run test:build` does that after a full build.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { copyFiles } = require("../../update-types");
const { NODE_LIB_SOURCE, NODE_RED_LIB_SOURCE } = require("../../setup");

let cached;

function getTypesDir() {
    if (cached) return cached;
    if (process.env.NR_MONACO_TYPES_DIR) {
        cached = path.resolve(process.env.NR_MONACO_TYPES_DIR);
        if (!fs.existsSync(cached)) throw new Error(`NR_MONACO_TYPES_DIR '${cached}' does not exist`);
        return cached;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nr-monaco-types-"));
    const log = console.log;
    console.log = () => {}; // copyFiles logs every file
    try {
        copyFiles(NODE_LIB_SOURCE, path.join(dir, "node"));
        copyFiles(NODE_RED_LIB_SOURCE, path.join(dir, "node-red"));
    } finally {
        console.log = log;
    }
    process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
    cached = dir;
    return cached;
}

module.exports = { getTypesDir };
