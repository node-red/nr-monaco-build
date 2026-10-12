/**
 * Do the types we ship actually resolve in node-red's Function node editor?
 *
 * Nothing here reports a missing type to the user: the editor turns broken types into `any` and
 * hides "cannot find module" (2307) and "property does not exist" (2339). These tests compile
 * the same files the editor loads, the same way, and fail on what the editor would hide.
 * See test/lib/editor-env.js for how the editor is reproduced.
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { knownModules } = require("./fixtures/editor-modules");
const { probeTypes, createEditorProgram, findUnresolved, userDiagnostics, USER_FILE } = require("./lib/editor-env");
const { getTypesDir } = require("./lib/types-dir");
const baseline = require("./lib/baseline");
const { monacoDir } = require("../setup");

const typesDir = getTypesDir();

/** `knownModules` entries that only make sense as default libs, never as a Setup tab module. */
const LIB_ONLY = ["globals", "globals.typedarray", "buffer.buffer", "node-red", "node-red-util", "node-red-func"];

/**
 * `knownModules` keys that are broken in node-red today. Each is asserted to still be broken, so
 * when it gets fixed this test fails and the entry can be removed.
 */
const KNOWN_BROKEN = {
    // test.d.ts only declares "node:test" (no bare alias), and `require("test")` fails at runtime
    // anyway. Fix direction depends on node-red/node-red#5991.
    "test": "keyed 'test' but test.d.ts only declares module 'node:test'",
    // A user adding `diagnostics_channel` on the Setup tab misses this key and gets
    // other/diagnostics_channel.d.ts (a 404). Typing the key itself is not a real module either.
    "diagnostics_channel.d": "key has a stray '.d', so 'diagnostics_channel' falls through to other/",
};

/**
 * Things every Function node relies on with no Setup tab modules. `expect` is matched against the
 * type as the editor would show it on hover.
 */
const DEFAULT_PROBES = [
    // Buffer: its overloads live in buffer.buffer.d.ts as of @types/node 24
    { expr: 'Buffer.from("abc")', expect: /^Buffer</ },
    { expr: "Buffer.alloc(4).readUInt8(0)", expect: /^number$/ },
    { expr: "Buffer.concat([Buffer.alloc(1)])", expect: /^Buffer</ },
    { expr: 'Buffer.isBuffer("x")', expect: /^boolean$/ },
    // NodeJS.TypedArray / ArrayBufferView: globals.typedarray.d.ts as of @types/node 24
    { expr: "/** @type {NodeJS.TypedArray} */ (undefined)", expect: /TypedArray/ },
    { expr: "/** @type {NodeJS.ArrayBufferView} */ (undefined)", expect: /ArrayBufferView|TypedArray|DataView/ },
    // timers, console, url, util
    { expr: "setTimeout(() => {}, 1)", expect: /Timeout/ },
    { expr: "setInterval(() => {}, 1)", expect: /Timeout/ },
    { expr: "setImmediate(() => {})", expect: /Immediate/ },
    { expr: 'console.log("x")', expect: /^void$/ },
    { expr: 'new URL("http://example.com").hostname', expect: /^string$/ },
    { expr: 'new URLSearchParams("a=1").get("a")', expect: /^string$/ },
    { expr: 'util.format("%s", "x")', expect: /^string$/ },
    { expr: 'util.types.isDate(new Date())', expect: /^boolean$/ },
    { expr: "promisify", expect: /promisify/ },
    // node-red-func / node-red-util
    { expr: "msg._msgid", expect: /^string$/ },
    { expr: "__msgid__", expect: /^string$/ },
    { expr: "node.send", expect: /NodeMessage/ },
    { expr: 'node.linkcall("target", {})', expect: /^Promise</ },
    { expr: "node.status", expect: /NodeStatus/ },
    { expr: "context.keys()", expect: /^string\[\]$/ },
    { expr: "flow.keys()", expect: /^string\[\]$/ },
    { expr: "global.keys()", expect: /^string\[\]$/ },
    { expr: 'env.get("NR_NODE_ID")', expect: /^any$/, allowAny: true },
    { expr: "RED.util.cloneMessage(msg)", expect: /^object$/ },
    { expr: "RED.util.generateId()", expect: /^string$/ },
];

/** Spot checks for Setup tab modules, beyond "it resolves". `mod` is the module's variable. */
const MODULE_PROBES = {
    "fs": [{ expr: 'mod.readFileSync("a", "utf8")', expect: /^string$/ }, { expr: 'mod.existsSync("a")', expect: /^boolean$/ }],
    "path": [{ expr: 'mod.join("a", "b")', expect: /^string$/ }],
    "os": [{ expr: "mod.hostname()", expect: /^string$/ }, { expr: "mod.cpus().length", expect: /^number$/ }],
    "crypto": [{ expr: 'mod.createHash("sha256").update("x").digest("hex")', expect: /^string$/ }, { expr: "mod.randomUUID()", expect: /`|string/ }],
    "zlib": [{ expr: "mod.gzipSync(Buffer.from(\"x\"))", expect: /Buffer/ }],
    "child_process": [{ expr: 'mod.execSync("ls")', expect: /Buffer|string/ }],
    "events": [{ expr: "new mod().on", expect: /=>/ }],
    "dns/promises": [{ expr: 'mod.lookup("example.com")', expect: /^Promise</ }],
    "timers/promises": [{ expr: "mod.setTimeout(1)", expect: /^Promise</ }],
    "querystring": [{ expr: 'mod.stringify({ a: 1 })', expect: /^string$/ }],
    "string_decoder": [{ expr: 'new mod.StringDecoder("utf8").write(Buffer.from("x"))', expect: /^string$/ }],
    "url": [{ expr: 'mod.fileURLToPath("file:///a")', expect: /^string$/ }],
    "util": [{ expr: "mod.inspect({})", expect: /^string$/ }],
    "net": [{ expr: "mod.isIP(\"1.2.3.4\")", expect: /^number$/ }],
    "http": [{ expr: "mod.STATUS_CODES", expect: /string/ }],
    "stream": [{ expr: "new mod.PassThrough().write", expect: /=>/ }],
};

function assertProbes({ results, diagnostics }, probes) {
    assert.deepEqual(diagnostics, [], "the Function node code should compile cleanly");
    results.forEach((r, i) => {
        const p = probes[i];
        assert.ok(!r.unresolved, `\`${r.expr}\` failed to resolve (shows as \`any\` in the editor)`);
        if (!p.allowAny) assert.ok(!r.any, `\`${r.expr}\` is \`any\``);
        assert.match(r.type, p.expect, `\`${r.expr}\` has type \`${r.type}\``);
    });
}

/** Compiles `mod;` with one Setup tab module and returns what the editor would know about it. */
function loadSetupModule(moduleName) {
    const { program, checker, missing } = createEditorProgram({ typesDir, modules: [{ var: "mod", module: moduleName }], code: "mod;\n" });
    const expr = program.getSourceFile(USER_FILE).statements[0].expression;
    const type = checker.getTypeAtLocation(expr);
    return { program, checker, missing, expr, type, diagnostics: userDiagnostics(program) };
}

function monacoTypeScriptVersion() {
    const pkgDir = monacoDir;
    const candidates = [
        "esm/vs/languages/features/typescript/lib/typescriptServices.js",
        "esm/vs/language/typescript/lib/typescriptServices.js",
    ].map((f) => path.join(pkgDir, f));
    const file = candidates.find((f) => fs.existsSync(f));
    assert.ok(file, `could not find monaco's bundled typescriptServices.js (looked in ${candidates.join(", ")})`);
    const m = /\bversion = "(\d+\.\d+\.\d+[^"]*)"/.exec(fs.readFileSync(file, "utf8"));
    assert.ok(m, `could not read the TypeScript version from ${file}`);
    return m[1];
}

describe("type resolution in the Function node editor", () => {
    it("tests use the same TypeScript as monaco's TS worker", () => {
        // Different major/minor versions can resolve the same .d.ts differently, which would make
        // these tests disagree with the editor. Pin the `typescript` devDependency to match.
        const majorMinor = (v) => v.split(".").slice(0, 2).join(".");
        assert.equal(majorMinor(ts.version), majorMinor(monacoTypeScriptVersion()),
            `typescript ${ts.version} is installed but monaco-editor bundles ${monacoTypeScriptVersion()}`);
    });

    it("loads every default lib", () => {
        const { missing } = createEditorProgram({ typesDir });
        assert.deepEqual(missing, [], "these default libs would 404 in the editor");
    });

    describe("default libs (no Setup tab modules)", () => {
        const run = probeTypes({ typesDir, probes: DEFAULT_PROBES.map((p) => p.expr) });
        run.results.forEach((r, i) => {
            it(r.expr, () => assertProbes({ results: [r], diagnostics: [] }, [DEFAULT_PROBES[i]]));
        });
        it("compiles the probes with no errors", () => assert.deepEqual(run.diagnostics, []));
    });

    describe("Setup tab modules", () => {
        const setupModules = Object.entries(knownModules)
            .filter(([key, m]) => m.package === "node" && !LIB_ONLY.includes(key))
            .map(([key]) => key);

        for (const key of setupModules) {
            if (KNOWN_BROKEN[key]) {
                it(`${key} (known broken: ${KNOWN_BROKEN[key]})`, () => {
                    const { type, diagnostics } = loadSetupModule(key);
                    assert.ok(diagnostics.length > 0 || type.flags & ts.TypeFlags.Any,
                        `'${key}' resolves now. Remove it from KNOWN_BROKEN in ${path.basename(__filename)}`);
                });
                continue;
            }
            it(key, () => {
                const { type, diagnostics, missing } = loadSetupModule(key);
                assert.deepEqual(missing, [], `the editor would 404 on these files for '${key}'`);
                assert.deepEqual(diagnostics, [], `adding '${key}' on the Setup tab should compile cleanly`);
                assert.ok(!(type.flags & ts.TypeFlags.Any), `'${key}' resolves to \`any\``);
                const probes = MODULE_PROBES[key];
                if (probes) {
                    assertProbes(probeTypes({ typesDir, modules: [{ var: "mod", module: key }], probes: probes.map((p) => p.expr) }), probes);
                }
            });
        }

        it("has spot checks only for modules the editor knows", () => {
            const unknown = Object.keys(MODULE_PROBES).filter((k) => !setupModules.includes(k));
            assert.deepEqual(unknown, []);
        });
    });

    describe("unresolved types match the baseline", () => {
        // The editor loads one file per module, so some cross-module types never resolve (for
        // example `http` uses types from `net` and `stream`). That is how it has always worked.
        // This test pins the current list so a version bump can't silently add to it.
        // Refresh with `npm run test:update-baseline` and review the diff.
        it("matches test/baselines/unresolved.json", () => {
            const actual = {};

            const globals = ["Buffer", "console", "util", "promisify", "node", "context", "flow", "global", "env", "RED.util", "URL", "URLSearchParams", "setTimeout", "setInterval", "setImmediate", "clearTimeout", "queueMicrotask", "structuredClone"];
            const { program, checker } = createEditorProgram({ typesDir, code: globals.map((g) => `${g};\n`).join("") });
            program.getSourceFile(USER_FILE).statements.forEach((stmt, i) => {
                actual[`global ${globals[i]}`] = findUnresolved(checker, checker.getTypeAtLocation(stmt.expression), stmt.expression);
            });

            for (const [key, m] of Object.entries(knownModules)) {
                if (m.package !== "node" || LIB_ONLY.includes(key) || KNOWN_BROKEN[key]) continue;
                const { checker, type, expr } = loadSetupModule(key);
                actual[`module ${key}`] = findUnresolved(checker, type, expr);
            }

            baseline.check("unresolved.json", actual);
        });
    });
});
