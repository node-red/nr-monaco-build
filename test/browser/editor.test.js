/**
 * Loads the built editor (output/monaco/dist) in headless Chromium.
 *
 * Catches what the other suites can't see from Node:
 * - the bundle or a language worker failing at runtime (the build succeeds either way)
 * - a locale file loading but no longer translating anything
 * - test/lib/editor-env.js disagreeing with monaco's real TS worker. The type tests are only
 *   worth something if that emulation matches the editor, so this compares the two directly.
 *
 * Needs a build and a browser: `npm run build`, `npx playwright install chromium`, then
 * `npm run test:browser`.
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const path = require("path");
const ts = require("typescript");
const { chromium } = require("playwright");
const { projectDir, targetDir, monacoDir } = require("../../setup");
const { knownModules, defaultServerSideTypes } = require("../fixtures/editor-modules");
const { probeTypes } = require("../lib/editor-env");

const typesDir = path.join(targetDir, "types");
const LOCALES = fs.readdirSync(path.join(targetDir, "monaco", "dist", "locale")).filter((f) => /^[a-z-]+\.js$/.test(f)).map((f) => f.slice(0, -3));

/**
 * Locales that load but don't translate. Each is asserted to still be broken, so a fix upstream
 * fails the test and the entry can go.
 */
const KNOWN_UNTRANSLATED = {
    // monaco-editor has published esm/vs/nls/lang/pt-br.js with every message null since at
    // least 0.55.1 (about 11 KB, against 130 KB or more for the other languages).
    "pt-br": "monaco-editor ships an empty pt-br message table",
};

const TYPES = { ".js": "text/javascript", ".json": "application/json", ".ts": "text/plain", ".ttf": "font/ttf", ".css": "text/css" };

/** Serves the repo root plus a bare page that loads the bundle (and optionally a locale). */
function startServer() {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, "http://localhost");
        if (url.pathname === "/harness.html") {
            const lang = url.searchParams.get("lang");
            res.writeHead(200, { "content-type": "text/html" });
            res.end(`<!DOCTYPE html><html><body>
                <script>window.__errors = []; addEventListener("error", (e) => __errors.push(String(e.message)));</script>
                ${lang ? `<script src="/output/monaco/dist/locale/${lang}.js"></script>` : ""}
                <script src="/output/monaco/dist/editor.js"></script>
                <div id="ed" style="width:800px;height:300px"></div>
            </body></html>`);
            return;
        }
        const file = path.join(projectDir, decodeURIComponent(url.pathname));
        if (!file.startsWith(targetDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

describe("built editor in a browser", () => {
    let server, browser, base;

    before(async () => {
        assert.ok(fs.existsSync(path.join(targetDir, "monaco", "dist", "editor.js")), "no build found, run `npm run build` first");
        server = await startServer();
        base = `http://127.0.0.1:${server.address().port}`;
        browser = await chromium.launch();
    });

    after(async () => {
        await browser?.close();
        server?.close();
    });

    async function openEditor(lang) {
        const page = await browser.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(`${base}/harness.html${lang ? `?lang=${lang}` : ""}`);
        await page.waitForFunction(() => typeof window.monaco === "object");
        return { page, errors };
    }

    it("loads the bundle with the expected monaco and TypeScript versions", async () => {
        const { page, errors } = await openEditor();
        const info = await page.evaluate(() => ({ monaco: monaco.version, ts: monaco.typescript.typescriptVersion, errors: window.__errors }));
        const expected = JSON.parse(fs.readFileSync(path.join(monacoDir, "package.json"), "utf8")).version;
        assert.equal(info.monaco, expected);
        assert.equal(info.ts, ts.version, "the tests' typescript should match the one in the bundle");
        assert.deepEqual([...errors, ...info.errors], []);
        await page.close();
    });

    it("runs every language worker", async () => {
        const { page, errors } = await openEditor();
        // Each worker proves itself by doing its job: diagnostics for ts/json/css, formatting
        // for html. A worker that fails to load just never answers.
        const result = await page.evaluate(async () => {
            const waitFor = async (fn, ms = 20000) => {
                const end = Date.now() + ms;
                while (Date.now() < end) {
                    const v = await fn();
                    if (v) return v;
                    await new Promise((r) => setTimeout(r, 100));
                }
                return null;
            };
            const markers = (lang, value) => {
                const model = monaco.editor.createModel(value, lang);
                return waitFor(() => monaco.editor.getModelMarkers({ resource: model.uri }).length > 0);
            };
            // The html formatter registers lazily, so keep asking until it does something.
            const ed = monaco.editor.create(document.getElementById("ed"), { value: "<html><body><div><p>a</p><p>b</p></div></body></html>", language: "html" });
            const html = await waitFor(async () => {
                await ed.getAction("editor.action.formatDocument").run();
                return ed.getValue().includes("\n");
            });
            return {
                typescript: !!(await markers("javascript", "const = ;")),
                json: !!(await markers("json", "{ \"a\": }")),
                css: !!(await markers("css", "body { color: ; }")),
                html: !!html,
            };
        });
        assert.deepEqual(result, { typescript: true, json: true, css: true, html: true });
        assert.deepEqual(errors, []);
        await page.close();
    });

    it("translates the UI for every locale", async () => {
        const label = async (lang) => {
            const { page, errors } = await openEditor(lang);
            const text = await page.evaluate(() => monaco.editor.create(document.getElementById("ed"), { language: "javascript" }).getAction("editor.action.formatDocument").label);
            assert.deepEqual(errors, [], `${lang || "en"} page errors`);
            await page.close();
            return text;
        };
        const english = await label();
        assert.equal(english, "Format Document");
        const untranslated = [];
        for (const lang of LOCALES) {
            if ((await label(lang)) === english) untranslated.push(lang);
        }
        assert.ok(LOCALES.length >= 10, `only found locales: ${LOCALES.join(", ")}`);
        assert.deepEqual(untranslated.filter((l) => !KNOWN_UNTRANSLATED[l]), [], "these locales load but show English");
        const fixed = Object.keys(KNOWN_UNTRANSLATED).filter((l) => LOCALES.includes(l) && !untranslated.includes(l));
        assert.deepEqual(fixed, [], "these are translated now, remove them from KNOWN_UNTRANSLATED");
    });

    describe("monaco's TS worker agrees with test/lib/editor-env.js", () => {
        /**
         * Loads libs the way node-red's monaco.js does, then reads each probe's type from the
         * worker's hover text and its diagnostics, for comparison with the Node emulation.
         */
        async function inBrowser({ defaults, modules = [], probes }) {
            const { page, errors } = await openEditor();
            const libs = [];
            const load = (m) => libs.push({
                uri: `file://types/${m.package}/${m.module}/index.d.ts`,
                text: fs.existsSync(path.join(typesDir, m.path)) ? fs.readFileSync(path.join(typesDir, m.path), "utf8") : `/* Failed to load 'types/${m.path}' */\n`,
            });
            defaults.forEach((key) => load(knownModules[key]));
            modules.forEach((lib) => load(knownModules[lib.module] || { package: "other", module: lib.module, path: `other/${lib.module}.d.ts` }));
            const shim = modules.length
                ? modules.map((l) => `import ${l.var}_import = require('${l.module}');\n`).join("") + "\ndeclare global {\n" + modules.map((l) => `var ${l.var}: typeof ${l.var}_import;\n`).join("") + "\n}"
                : null;
            const code = probes.map((expr, i) => `const __probe_${i} = (${expr});\n`).join("");

            const out = await page.evaluate(async ({ libs, shim, code, count }) => {
                const t = monaco.typescript;
                t.javascriptDefaults.setCompilerOptions({
                    allowJs: true, checkJs: true, allowNonTsExtensions: true, target: t.ScriptTarget.ESNext,
                    strictNullChecks: false, strictPropertyInitialization: true, strictFunctionTypes: true,
                    strictBindCallApply: true, useDefineForClassFields: true,
                    moduleResolution: t.ModuleResolutionKind.NodeJs, module: t.ModuleKind.CommonJS,
                    typeRoots: ["types"], lib: ["esnext"],
                });
                libs.forEach((l) => t.javascriptDefaults.addExtraLib(l.text, l.uri));
                if (shim) t.javascriptDefaults.addExtraLib(shim, "file://types/extraModuleLibs/index.d.ts");
                const model = monaco.editor.createModel(code, "javascript", monaco.Uri.parse("file:///src/function.js"));
                const worker = await (await t.getJavaScriptWorker())(model.uri);
                const uri = model.uri.toString();
                const types = [];
                for (let i = 0; i < count; i++) {
                    const info = await worker.getQuickInfoAtPosition(uri, code.indexOf(`__probe_${i} `) + 1);
                    const text = (info?.displayParts || []).map((p) => p.text).join("");
                    types.push(text.replace(/^const __probe_\d+: /, ""));
                }
                const diags = [...await worker.getSyntacticDiagnostics(uri), ...await worker.getSemanticDiagnostics(uri)];
                return { types, codes: diags.map((d) => d.code).sort() };
            }, { libs, shim, code, count: probes.length });
            assert.deepEqual(errors, []);
            await page.close();
            return out;
        }

        function inNode({ defaults, modules = [], probes }) {
            const original = [...defaultServerSideTypes];
            defaultServerSideTypes.splice(0, defaultServerSideTypes.length, ...defaults);
            try {
                const r = probeTypes({ typesDir, modules, probes });
                const codes = r.diagnostics.filter((d) => d.startsWith("/src/function.js")).map((d) => Number(/TS(\d+)/.exec(d)[1])).sort();
                return { types: r.results.map((x) => x.type), codes };
            } finally {
                defaultServerSideTypes.splice(0, defaultServerSideTypes.length, ...original);
            }
        }

        const PROBES = [
            'Buffer.from("abc")', "Buffer.alloc(4).readUInt8(0)", "/** @type {NodeJS.TypedArray} */ (undefined)",
            'setTimeout(() => {}, 1)', 'new URL("http://x").hostname', 'util.format("x")', "msg._msgid",
            'node.linkcall("t", {})', "RED.util.generateId()", "context.keys()", "process",
        ];

        const cases = [
            { name: "default libs", defaults: defaultServerSideTypes, probes: PROBES },
            {
                // The old default list: Buffer and NodeJS.TypedArray break. Both sides must agree.
                name: "default libs without buffer.buffer and globals.typedarray",
                defaults: defaultServerSideTypes.filter((k) => k !== "buffer.buffer" && k !== "globals.typedarray"),
                probes: PROBES,
            },
            {
                name: "Setup tab modules fs, os, assert/strict and test",
                defaults: defaultServerSideTypes,
                modules: [{ var: "fs", module: "fs" }, { var: "os", module: "os" }, { var: "strict", module: "assert/strict" }, { var: "nodeTest", module: "test" }],
                probes: ['fs.readFileSync("a", "utf8")', "os.hostname()", "strict.equal", "nodeTest"],
            },
        ];

        for (const c of cases) {
            it(c.name, async () => {
                const browserSide = await inBrowser(c);
                const nodeSide = inNode(c);
                const pairs = c.probes.map((expr, i) => `${expr} => ${browserSide.types[i]}`);
                assert.deepEqual(c.probes.map((expr, i) => `${expr} => ${nodeSide.types[i]}`), pairs, "probe types differ (+ node emulation, - monaco's worker)");
                assert.deepEqual(nodeSide.codes, browserSide.codes, "diagnostic codes differ (+ node emulation, - monaco's worker)");
            });
        }
    });
});
