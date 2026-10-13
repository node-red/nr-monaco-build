/**
 * What ends up in output/types, and what deliberately doesn't.
 *
 * update-types.js drops some @types/node files by name (excludeLibs). When @types/node renames
 * or splits a file, the exclusion silently stops working; that is how the ~4400 line
 * inspector.generated.d.ts got back into the bundle. These tests make that loud.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { excludeLibs } = require("../update-types");
const { NODE_LIB_SOURCE } = require("../setup");
const { knownModules, notBuiltHere } = require("./fixtures/editor-modules");
const { getTypesDir } = require("./lib/types-dir");
const baseline = require("./lib/baseline");

const typesDir = getTypesDir();

/** Relative paths (forward slashes) of every .ts file under dir. */
function listDts(dir) {
    return fs.readdirSync(dir, { recursive: true })
        .map((f) => f.split(path.sep).join("/"))
        .filter((f) => f.includes(".ts") && fs.statSync(path.join(dir, f)).isFile())
        .sort();
}

/** Module names a .d.ts file declares (`declare module "x"`), without any `node:` prefix. */
function declaredModules(file) {
    const src = fs.readFileSync(file, "utf8");
    return [...new Set([...src.matchAll(/^\s*declare module ["']([^"']+)["']/gm)].map((m) => m[1].replace(/^node:/, "")))];
}

describe("bundle content", () => {
    const sourceFiles = listDts(NODE_LIB_SOURCE);
    const shippedNode = listDts(path.join(typesDir, "node"));
    const shippedNodeRed = listDts(path.join(typesDir, "node-red"));

    it("every excludeLibs entry still matches a file in @types/node", () => {
        // An entry that matches nothing means @types/node renamed or dropped the file, and
        // whatever replaced it is probably shipping now. Find the new name and exclude it.
        const unmatched = excludeLibs.filter((name) => !sourceFiles.some((f) => path.posix.basename(f) === name));
        assert.deepEqual(unmatched, [], "these excludeLibs entries match nothing in node_modules/@types/node");
    });

    it("ships none of the excluded files", () => {
        const leaked = shippedNode.filter((f) => excludeLibs.includes(path.posix.basename(f)));
        assert.deepEqual(leaked, []);
    });

    it("ships no declarations for modules that only excluded files declare", () => {
        // Catches a file that gets renamed out from under the exclude list, e.g. the V8
        // inspector protocol moving from inspector.d.ts to inspector.generated.d.ts.
        const excludedModules = new Set(sourceFiles
            .filter((f) => excludeLibs.includes(path.posix.basename(f)))
            .flatMap((f) => declaredModules(path.join(NODE_LIB_SOURCE, f))));
        assert.ok(excludedModules.has("inspector"), "expected the excluded files to declare 'inspector'");
        const leaked = shippedNode.flatMap((f) => declaredModules(path.join(typesDir, "node", f))
            .filter((m) => excludedModules.has(m))
            .map((m) => `${f} declares '${m}'`));
        assert.deepEqual(leaked, []);
    });

    it("ships every file the editor fetches", () => {
        const missing = Object.entries(knownModules)
            .filter(([key]) => !notBuiltHere.includes(key))
            .map(([key, m]) => ({ key, file: path.join(typesDir, m.path) }))
            .filter(({ file }) => !fs.existsSync(file))
            .map(({ key, file }) => `${key}: ${path.relative(typesDir, file)}`);
        assert.deepEqual(missing, [], "node-red's knownModules points at files that are not in the build");
    });

    it("ships the files in test/baselines/shipped-files.json", () => {
        // New or renamed files in @types/node show up here, so someone decides whether they
        // belong in the editor instead of them shipping by default.
        baseline.check("shipped-files.json", { "node": shippedNode, "node-red": shippedNodeRed });
    });
});
