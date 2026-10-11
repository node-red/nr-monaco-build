/**
 * A copy of what node-red's Function node editor loads from the files this repo builds.
 *
 * Source: node-red `packages/node_modules/@node-red/editor-client/src/js/ui/editors/code-editors/monaco.js`
 * (`knownModules`, `defaultServerSideTypes` and the javascriptDefaults compiler options).
 *
 * The editor fetches exactly one `.d.ts` file per entry and nothing else, so this table is the
 * contract between the two repos. Keep it in step with node-red: `npm run test:node-red-sync`
 * compares it with a node-red checkout.
 */

const knownModules = {
    "assert": {package: "node", module: "assert", path: "node/assert.d.ts" },
    "assert/strict": {package: "node", module: "assert/strict", path: "node/assert/strict.d.ts" },
    "async_hooks": {package: "node", module: "async_hooks", path: "node/async_hooks.d.ts" },
    "buffer": {package: "node", module: "buffer", path: "node/buffer.d.ts" },
    "buffer.buffer": {package: "node", module: "buffer.buffer", path: "node/buffer.buffer.d.ts" },
    "child_process": {package: "node", module: "child_process", path: "node/child_process.d.ts" },
    "cluster": {package: "node", module: "cluster", path: "node/cluster.d.ts" },
    "console": {package: "node", module: "console", path: "node/console.d.ts" },
    "crypto": {package: "node", module: "crypto", path: "node/crypto.d.ts" },
    "dgram": {package: "node", module: "dgram", path: "node/dgram.d.ts" },
    "diagnostics_channel.d": {package: "node", module: "diagnostics_channel", path: "node/diagnostics_channel.d.ts" },
    "dns": {package: "node", module: "dns", path: "node/dns.d.ts" },
    "dns/promises": {package: "node", module: "dns/promises", path: "node/dns/promises.d.ts" },
    "domain": {package: "node", module: "domain", path: "node/domain.d.ts" },
    "events": {package: "node", module: "events", path: "node/events.d.ts" },
    "fs": {package: "node", module: "fs", path: "node/fs.d.ts" },
    "fs/promises": {package: "node", module: "fs/promises", path: "node/fs/promises.d.ts" },
    "globals": {package: "node", module: "globals", path: "node/globals.d.ts" },
    "globals.typedarray": {package: "node", module: "globals.typedarray", path: "node/globals.typedarray.d.ts" },
    "http": {package: "node", module: "http", path: "node/http.d.ts" },
    "http2": {package: "node", module: "http2", path: "node/http2.d.ts" },
    "https": {package: "node", module: "https", path: "node/https.d.ts" },
    "module": {package: "node", module: "module", path: "node/module.d.ts" },
    "net": {package: "node", module: "net", path: "node/net.d.ts" },
    "os": {package: "node", module: "os", path: "node/os.d.ts" },
    "path": {package: "node", module: "path", path: "node/path.d.ts" },
    "perf_hooks": {package: "node", module: "perf_hooks", path: "node/perf_hooks.d.ts" },
    "process": {package: "node", module: "process", path: "node/process.d.ts" },
    "querystring": {package: "node", module: "querystring", path: "node/querystring.d.ts" },
    "readline": {package: "node", module: "readline", path: "node/readline.d.ts" },
    "stream": {package: "node", module: "stream", path: "node/stream.d.ts" },
    "stream/consumers": {package: "node", module: "stream/consumers", path: "node/stream/consumers.d.ts" },
    "stream/promises": {package: "node", module: "stream/promises", path: "node/stream/promises.d.ts" },
    "stream/web": {package: "node", module: "stream/web", path: "node/stream/web.d.ts" },
    "string_decoder": {package: "node", module: "string_decoder", path: "node/string_decoder.d.ts" },
    "test": {package: "node", module: "test", path: "node/test.d.ts" },
    "timers": {package: "node", module: "timers", path: "node/timers.d.ts" },
    "timers/promises": {package: "node", module: "timers/promises", path: "node/timers/promises.d.ts" },
    "tls": {package: "node", module: "tls", path: "node/tls.d.ts" },
    "trace_events": {package: "node", module: "trace_events", path: "node/trace_events.d.ts" },
    "tty": {package: "node", module: "tty", path: "node/tty.d.ts" },
    "url": {package: "node", module: "url", path: "node/url.d.ts" },
    "util": {package: "node", module: "util", path: "node/util.d.ts" },
    "v8": {package: "node", module: "v8", path: "node/v8.d.ts" },
    "vm": {package: "node", module: "vm", path: "node/vm.d.ts" },
    "wasi": {package: "node", module: "wasi", path: "node/wasi.d.ts" },
    "worker_threads": {package: "node", module: "worker_threads", path: "node/worker_threads.d.ts" },
    "zlib": {package: "node", module: "zlib", path: "node/zlib.d.ts" },
    "node-red": {package: "node-red", module: "node-red", path: "node-red/index.d.ts" },
    "node-red-util": {package: "node-red", module: "util", path: "node-red/util.d.ts" },
    "node-red-func": {package: "node-red", module: "func", path: "node-red/func.d.ts" },
};

/** Keys of `knownModules` that the editor loads into every Function node editor. */
const defaultServerSideTypes = ["node-red-util", "node-red-func", "globals", "globals.typedarray", "console", "buffer", "buffer.buffer", "timers", "url", "util"];

/**
 * `knownModules` entries that are not loaded from this repo's output:
 * `node-red/index.d.ts` only exists when node-red's own grunt build concatenates the node-red types.
 */
const notBuiltHere = ["node-red"];

/**
 * The javascriptDefaults compiler options the editor sets, with monaco's enums swapped for the
 * matching `typescript` ones.
 * @param {typeof import('typescript')} ts
 */
function compilerOptions(ts) {
    return {
        allowJs: true,
        checkJs: true,
        allowNonTsExtensions: true,
        target: ts.ScriptTarget.ESNext,
        strictNullChecks: false,
        strictPropertyInitialization: true,
        strictFunctionTypes: true,
        strictBindCallApply: true,
        useDefineForClassFields: true,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        module: ts.ModuleKind.CommonJS,
        typeRoots: ["types"],
        lib: ["lib.esnext.d.ts"],
        // monaco's worker host cannot list directories, so it never auto-includes type packages.
        // Say so explicitly here so nothing under node_modules/@types leaks into the tests.
        types: [],
        noEmit: true,
    };
}

module.exports = { knownModules, defaultServerSideTypes, notBuiltHere, compilerOptions };
