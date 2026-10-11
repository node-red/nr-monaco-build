/**
 * Is the node-red this build is going into in step with this repo?
 *
 * node-red-types/*.d.ts are edited here and copied into node-red by `npm run copy`. When node-red's
 * copies get changed directly instead (that is how `node.linkcall()` and a stale
 * `RED.util.linkcall` drifted), that change has to come back here or the next copy undoes it.
 * And test/fixtures/editor-modules.js is a copy of what node-red's monaco.js loads, so the type
 * tests are only as good as that copy. Expect differences while the matching node-red PR is open.
 *
 * This compares both with node-red. Not part of `npm test`, because the answer depends on
 * another repo's state. Run `npm run test:node-red-sync`, with one of:
 *   NODE_RED_DIR=../node-red   a local checkout (whatever branch it is on)
 *   NODE_RED_REF=dev           a branch, tag or sha on github.com/node-red/node-red (default: master)
 */
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { NODE_RED_LIB_SOURCE } = require("../../setup");
const fixture = require("../fixtures/editor-modules");

const EDITOR_SRC = "packages/node_modules/@node-red/editor-client/src";
const MONACO_JS = `${EDITOR_SRC}/js/ui/editors/code-editors/monaco.js`;
const NOTE = /^\s*\/\* NOTE: Do not edit directly! This file is generated[^\n]*\*\/\s*/;

const source = process.env.NODE_RED_DIR
    ? { label: `local checkout ${path.resolve(process.env.NODE_RED_DIR)}`, dir: path.resolve(process.env.NODE_RED_DIR) }
    : { label: `github.com/node-red/node-red@${process.env.NODE_RED_REF || "master"}`, ref: process.env.NODE_RED_REF || "master" };

async function readNodeRed(file) {
    if (source.dir) {
        return fs.readFileSync(path.join(source.dir, file), "utf8");
    }
    const url = `https://raw.githubusercontent.com/node-red/node-red/${encodeURIComponent(source.ref)}/${file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url}: ${res.status} ${res.statusText}`);
    return res.text();
}

// Leading/trailing blank lines and trailing whitespace are noise, so they're ignored.
const lines = (text) => text.replace(/\r\n/g, "\n").replace(NOTE, "").trim().split("\n").map((l) => l.trimEnd());

/** Pulls the `knownModules` literal and `defaultServerSideTypes` keys out of monaco.js. */
function parseMonacoJs(src) {
    const start = src.indexOf("const knownModules = {");
    assert.ok(start >= 0, "could not find `const knownModules = {` in monaco.js");
    const end = src.indexOf("\n    }", start);
    const literal = src.slice(src.indexOf("{", start), end + 6);
    // JSON round trip: objects made in another vm context fail deepStrictEqual on prototype alone.
    const knownModules = JSON.parse(JSON.stringify(vm.runInNewContext(`(${literal})`, {}, { timeout: 1000 })));

    const m = /const defaultServerSideTypes = \[(.*)\];/.exec(src);
    assert.ok(m, "could not find `const defaultServerSideTypes = [...]` in monaco.js");
    const defaultServerSideTypes = [...m[1].matchAll(/knownModules\["([^"]+)"\]/g)].map((x) => x[1]);
    return { knownModules, defaultServerSideTypes };
}

describe(`in step with node-red (${source.label})`, () => {
    for (const name of ["func.d.ts", "util.d.ts"]) {
        it(`node-red-types/${name} matches node-red's copy`, async () => {
            const ours = lines(fs.readFileSync(path.join(NODE_RED_LIB_SOURCE, name), "utf8"));
            const theirs = lines(await readNodeRed(`${EDITOR_SRC}/types/node-red/${name}`));
            // + is node-red's copy, - is ours. Either copy ours over (npm run copy) or bring
            // node-red's change back into node-red-types/, whichever is right.
            assert.deepEqual(theirs, ours, `node-red-types/${name} and node-red's types/node-red/${name} differ`);
        });
    }

    describe("test/fixtures/editor-modules.js matches monaco.js", () => {
        let parsed;
        before(async () => { parsed = parseMonacoJs(await readNodeRed(MONACO_JS)); });

        it("knownModules", () => {
            assert.deepEqual(parsed.knownModules, fixture.knownModules,
                "update the fixture to match monaco.js, then run `npm test` to see what changed");
        });

        it("defaultServerSideTypes", () => {
            assert.deepEqual(parsed.defaultServerSideTypes, fixture.defaultServerSideTypes,
                "update the fixture to match monaco.js, then run `npm test` to see what changed");
        });
    });
});
