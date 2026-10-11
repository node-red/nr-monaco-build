/**
 * Smoke test for a finished build: the files node-red's `npm run copy` picks up are all there.
 *
 * Run with `npm run test:build`, which does a full `npm run build` first and then runs the
 * other suites against output/types too. Needs network access (npm and the vscode-loc download).
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { targetDir } = require("../../setup");

const dist = path.join(targetDir, "monaco", "dist");

/** Smallest plausible size for each bundle. Real sizes are 0.3 to 7 MB. */
const BUNDLES = {
    "editor.js": 1_000_000,
    "editor.worker.js": 100_000,
    "ts.worker.js": 1_000_000,
    "json.worker.js": 100_000,
    "css.worker.js": 100_000,
    "html.worker.js": 100_000,
};

/** Locales the build has always produced (monaco's vscode-loc languages). */
const LOCALES = ["cs", "de", "es", "fr", "it", "ja", "ko", "pl", "pt-br", "ru", "tr", "zh-cn", "zh-tw"];

const size = (f) => (fs.existsSync(f) ? fs.statSync(f).size : 0);

describe("build output", () => {
    it("has the editor bundle and every language worker", () => {
        const problems = Object.entries(BUNDLES)
            .filter(([name, min]) => size(path.join(dist, name)) < min)
            .map(([name, min]) => `${name}: ${size(path.join(dist, name))} bytes, expected at least ${min}`);
        assert.deepEqual(problems, []);
    });

    it("has a locale file for every language", () => {
        const missing = LOCALES.filter((l) => size(path.join(dist, "locale", `${l}.js`)) === 0);
        assert.deepEqual(missing, []);
    });

    it("has the themes", () => {
        const themes = fs.readdirSync(path.join(dist, "theme")).filter((f) => f.endsWith(".json"));
        assert.ok(themes.length >= 50, `expected at least 50 themes, found ${themes.length}`);
        for (const t of themes) {
            assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(dist, "theme", t), "utf8")), `theme/${t} is not valid JSON`);
        }
    });

    it("has the node and node-red types", () => {
        for (const f of ["node/globals.d.ts", "node/buffer.d.ts", "node-red/func.d.ts", "node-red/util.d.ts"]) {
            assert.ok(size(path.join(targetDir, "types", f)) > 0, `output/types/${f} is missing or empty`);
        }
    });
});
