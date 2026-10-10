const degit = require('degit');
const fs = require("fs");
const path = require("path");
const recursive = require("recursive-readdir");
const mkdirp = require("mkdirp");
const { replaceInFileSync } = require("replace-in-file");
const ncp = require("ncp").ncp;
const { rimraf } = require("rimraf");
const readJson = require('read-package-json')
const { semver } = require("./common");

const {
    monacoDir,
    monacoModDir,
    monacoModEsmDir,
    gitDir
} = require("./setup");


function readPackage(packageFile) {
    return new Promise(function (resolve, reject) {
        readJson(packageFile, console.error, false, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data)
            }
        });
    });
}

/**
 * Perform replacements in the monaco-editor-esm-i18n source to inject version and prevent firing events with undefined
 * @param callback
 */
function injectSourcePath(monacoVersion, callback) {
    rimraf(monacoModDir).then(() => {
        ncp(monacoDir, monacoModDir, function (err) {
            if (err) {
                callback(err);
                return;
            }
            recursive(monacoModEsmDir, (err, files) => {
                if (err) {
                    callback(err);
                    return;
                }
                files.forEach(file => {
                    if (file.endsWith(".js")) {
                        if (file.endsWith("base\\common\\cancellation.js") || file.endsWith("base/common/cancellation.js")) {
                            // Disable this line to prevent firing the event with undefined
                            // See: https://github.com/microsoft/monaco-editor/issues/4389#issuecomment-2715085208
                            replaceInFileSync({
                                files: file,
                                from: /this\._emitter\.fire\(undefined\);/,
                                to: '// Disabled by nr-monaco-build: this._emitter.fire(undefined);',
                            });
                        } else if (file.endsWith("base\\common\\async.js") || file.endsWith("base/common/async.js")) {
                            // Disable this line to prevent firing the event with undefined
                            // See: https://github.com/cardstack/boxel/commit/7cacc9e15020696b89e07e4badd4f6a124975109
                            replaceInFileSync({
                                files: file,
                                // this.doReject?.(new CancellationError());
                                from: /this\.doReject\?\.\(new CancellationError/,
                                to: '// Disabled by nr-monaco-build: this.doReject?.(new CancellationError',
                            });
                        } else if (file.endsWith("iconLabels.js")) {
                            // if a translation is missing, prevent error in  `stripIcons`  (ensures command palette is populated)
                            // this should be located at node_modules/monaco-editor-esm-i18n/esm/vs/base/common/iconLabels.js
                            // find:
                            // `stripIcons(text) {`
                            // replace with:
                            // stripIcons(text) {
                            //   text = text || "";
                            replaceInFileSync({
                                files: file,
                                from: [
                                    /stripIcons\(text\)\s?{/g
                                ],
                                to: [
                                    `stripIcons(text) {\n  text = text || "";`
                                ],
                            });
                        } else if (file.search(/[\\|\/]editor[\\|\/]editor\.api2?\.js$/) > -1) {
                            // Up to monaco 0.55.x the base API was constructed in editor.api2.js, with
                            // editor.api.js/editor.main.js re-exporting `from './editor.api2.js'`.
                            // From monaco 0.56.0 editor.api2.js was merged directly into editor.api.js, so
                            // this now matches editor.api.js itself. Either way, inject the version getter
                            // right after whichever file actually calls createMonacoBaseAPI().
                            // 1. Find      const api = createMonacoBaseAPI();
                            // 2. Insert    Object.defineProperty(api, 'version', {get: function() { return 'x.y.z' }});
                            //             export const version = api.version;
                            replaceInFileSync({
                                files: file,
                                from: [
                                    /(const\s+?)(\w*?)(\s+?=\s+?createMonacoBaseAPI\(\).*$)/gm
                                ],
                                to: [
                                    `$1$2$3` +
                                    `\nObject.defineProperty($2, 'version', {get: function() { return '${monacoVersion}' }});` +
                                    `\nexport const version = $2.version;`
                                ],
                            });
                        }
                        // Any file that re-exports the base API symbols `from` editor.api.js/editor.api2.js
                        // (editor.main.js and, from monaco 0.56.0, the new esm/vs/index.js package entry
                        // point) needs `version` added to its re-export list too. Applied generically
                        // (not gated to a specific filename) since the package entry point/path has moved
                        // between monaco versions and is a no-op replace-in-file for files that don't match.
                        {
                            replaceInFileSync({
                                files: file,
                                from: [
                                    /(export\s*{[^}]*?)(\s*}\s*from\s*['"]\.\/(?:editor\/)?editor\.api2?\.js['"])/gm
                                ],
                                to: [
                                    `$1, version$2`
                                ],
                            });
                        }
                    }
                });
                callback();
            });
        });
    }).catch(err => {
        callback(err);
    })
}


async function main() {
    const pkg = await readPackage("package.json");
    const monacoDep = pkg.devDependencies["monaco-editor"];
    const monacoSemver = semver(monacoDep);
    const monacoVersion = monacoSemver.toString();

    mkdirp.sync(gitDir);
    injectSourcePath(monacoVersion, err => {
        if (err) throw err;
    });
}

main();
