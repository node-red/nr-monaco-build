const path = require("path");

exports.projectDir = __dirname;
exports.srcDir = path.join(exports.projectDir);
exports.targetDir = path.join(exports.projectDir, "output");
exports.tempDir = path.join(exports.projectDir, "temp");
exports.npmDir = path.join(exports.srcDir);

exports.nodeModulesDir= path.join(exports.npmDir, "node_modules");
exports.monacoDir = path.join(exports.nodeModulesDir, "monaco-editor");

exports.monacoModDir = path.join(exports.nodeModulesDir, "monaco-editor-esm-i18n");
exports.monacoModEsmDir= path.join(exports.monacoModDir, "esm");
exports.monacoThemesDir= path.join(exports.npmDir, "monaco-themes/themes");

exports.gitDir = path.join(exports.tempDir, "git");
exports.vsCodeLocDir = path.join(exports.gitDir, "vscode-loc");
exports.vsCodeLocI18nDir = path.join(exports.vsCodeLocDir, "i18n");
exports.generatedSourceLocaleDir = path.join(exports.targetDir, "monaco/dist/locale");

exports.MINIFY_DTS = false;
exports.NODE_VERSION_TO_INCLUDE = "v18.11.9";
exports.NODE_LIB_SOURCE = path.join(exports.projectDir, 'node_modules/@types/node');
exports.NODE_LIB_DESTINATION = path.join(exports.projectDir, 'output/types/node');

exports.NODE_RED_LIB_SOURCE = path.join(exports.projectDir, 'node-red-types');
exports.NODE_RED_LIB_DESTINATION = path.join(exports.projectDir, 'output/types/node-red');