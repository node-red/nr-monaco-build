/**
 * Rebuilds, with the TypeScript compiler API, the program that monaco's TS worker sees in
 * node-red's Function node editor.
 *
 * It copies what monaco.js does:
 * - every loaded `.d.ts` is added on its own as `file://types/<package>/<module>/index.d.ts`
 *   (here `/types/<package>/<module>/index.d.ts`), so a lib file only ever sees the other lib
 *   files the editor happened to load
 * - a lib the editor fails to fetch becomes a comment, like the editor's 404 handling
 * - modules added on the Setup tab go through the same `import x_import = require('m')` and
 *   `declare global { var x: typeof x_import }` shim as `refreshModuleLibs()`
 * - user code is a checkJs JavaScript file
 *
 * The editor hides 2307 (cannot find module) and 2339 (property does not exist) from users, so
 * a broken lib shows up as `any` with no error. The checks here look for exactly that.
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { knownModules, defaultServerSideTypes, compilerOptions } = require("../fixtures/editor-modules");

const SHIM_FILE = "/types/extraModuleLibs/index.d.ts";
const USER_FILE = "/src/function.js";

/**
 * @param {object} opts
 * @param {string} opts.typesDir - folder holding `node/` and `node-red/` (like output/types)
 * @param {{var: string, module: string}[]} [opts.modules] - Setup tab modules
 * @param {string} [opts.code] - Function node code
 */
function createEditorProgram({ typesDir, modules = [], code = "" }) {
    const files = new Map();
    const missing = [];

    function loadLib(mod) {
        const fileName = `/types/${mod.package}/${mod.module}/index.d.ts`;
        const src = path.join(typesDir, mod.path);
        if (fs.existsSync(src)) {
            files.set(fileName, fs.readFileSync(src, "utf8"));
        } else {
            missing.push(mod.path);
            files.set(fileName, `/* Failed to load 'types/${mod.path}' */\n`);
        }
    }

    defaultServerSideTypes.forEach((key) => loadLib(knownModules[key]));

    if (modules.length) {
        const imports = [];
        const defs = [];
        for (const lib of modules) {
            imports.push(`import ${lib.var}_import = require('${lib.module}');\n`);
            defs.push(`var ${lib.var}: typeof ${lib.var}_import;\n`);
            loadLib(knownModules[lib.module] || { package: "other", module: lib.module, path: `other/${lib.module}.d.ts` });
        }
        files.set(SHIM_FILE, imports.join("") + "\ndeclare global {\n" + defs.join("") + "\n}");
    }

    files.set(USER_FILE, code);

    const options = compilerOptions(ts);
    const host = ts.createCompilerHost(options, true);
    const realReadFile = host.readFile;
    const realFileExists = host.fileExists;
    const libDir = path.dirname(ts.getDefaultLibFilePath(options));
    const isTsLib = (f) => path.resolve(f).startsWith(path.resolve(libDir));
    const norm = (f) => f.replace(/\\/g, "/").replace(/^[a-zA-Z]:/, "");

    host.fileExists = (f) => files.has(norm(f)) || (isTsLib(f) && realFileExists(f));
    host.readFile = (f) => (files.has(norm(f)) ? files.get(norm(f)) : isTsLib(f) ? realReadFile(f) : undefined);
    host.getSourceFile = (f, languageVersion) => {
        const text = host.readFile(f);
        return text === undefined ? undefined : ts.createSourceFile(f, text, languageVersion, true);
    };
    host.directoryExists = (d) => isTsLib(d) || [...files.keys()].some((f) => f.startsWith(norm(d).replace(/\/?$/, "/")));
    host.getDirectories = () => [];
    host.getCurrentDirectory = () => "/src";
    host.writeFile = () => {};

    const program = ts.createProgram([...files.keys()], options, host);
    return { program, checker: program.getTypeChecker(), missing };
}

/** Diagnostics for the files a user can see: their code and the Setup tab shim. */
function userDiagnostics(program) {
    return [USER_FILE, SHIM_FILE]
        .map((f) => program.getSourceFile(f))
        .filter(Boolean)
        .flatMap((sf) => [...program.getSyntacticDiagnostics(sf), ...program.getSemanticDiagnostics(sf)])
        .map(formatDiagnostic);
}

function formatDiagnostic(d) {
    const msg = ts.flattenDiagnosticMessageText(d.messageText, " ");
    if (!d.file) return `TS${d.code}: ${msg}`;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    return `${d.file.fileName}:${line + 1} TS${d.code}: ${msg}`;
}

/** The checker's error type: what an unresolved name or module turns into. Prints as `any`. */
function isErrorType(type) {
    return !!(type.flags & ts.TypeFlags.Any) && type.intrinsicName === "error";
}

/**
 * Evaluates expressions as if typed into a Function node and returns the type of each one.
 * Wrap a type with JSDoc to probe types rather than values:
 * `/** @type {NodeJS.TypedArray} *\/ (undefined)`.
 * @param {object} opts - as createEditorProgram, plus `probes: string[]`
 */
function probeTypes({ probes, ...opts }) {
    const code = probes.map((expr, i) => `const __probe_${i} = (${expr});\n`).join("");
    const { program, checker, missing } = createEditorProgram({ ...opts, code });
    const sf = program.getSourceFile(USER_FILE);
    const results = [];
    sf.statements.forEach((stmt, i) => {
        const decl = stmt.declarationList.declarations[0];
        const type = checker.getTypeAtLocation(decl.initializer);
        results.push({
            expr: probes[i],
            // Printed like the editor's hover text, relative to the user's code.
            type: checker.typeToString(type, decl, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope),
            any: !!(type.flags & ts.TypeFlags.Any),
            unresolved: isErrorType(type),
        });
    });
    return { results, diagnostics: userDiagnostics(program), missing, program, checker };
}

/**
 * Lists the places in a module's API where a type failed to resolve: exported members, their
 * call/construct signature parameters and return types, one level deep. Each one shows up in
 * the editor as `any` with no warning.
 * @param {ts.TypeChecker} checker
 * @param {ts.Type} moduleType
 * @param {ts.Node} location
 */
function findUnresolved(checker, moduleType, location) {
    const found = new Set();
    const visitSignatures = (owner, type) => {
        for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct]) {
            // Overloads share a label so a new overload upstream doesn't reshuffle the baseline.
            checker.getSignaturesOfType(type, kind).forEach((sig) => {
                const label = `${owner}${kind === ts.SignatureKind.Construct ? " new" : ""}`;
                sig.getParameters().forEach((p) => {
                    if (isErrorType(checker.getTypeOfSymbolAtLocation(p, location))) found.add(`${label}(${p.getName()})`);
                });
                if (isErrorType(sig.getReturnType())) found.add(`${label} returns`);
            });
        }
    };
    if (isErrorType(moduleType)) return ["<itself>"];
    visitSignatures("<itself>", moduleType);
    for (const prop of checker.getPropertiesOfType(moduleType)) {
        const t = checker.getTypeOfSymbolAtLocation(prop, location);
        if (isErrorType(t)) {
            found.add(prop.getName());
            continue;
        }
        visitSignatures(prop.getName(), t);
    }
    return [...found].sort();
}

module.exports = { createEditorProgram, probeTypes, findUnresolved, userDiagnostics, isErrorType, USER_FILE, SHIM_FILE };
