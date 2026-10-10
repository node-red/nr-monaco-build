const path = require("path");
const { monacoModDir } = require("./setup");
const monacoModPath = path.resolve(__dirname, "node_modules", monacoModDir);
const LimitChunkCountPlugin = require("webpack/lib/optimize/LimitChunkCountPlugin");
const fs = require('fs');
const NormalModuleReplacementPlugin = require("webpack/lib/NormalModuleReplacementPlugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = (env, argv) => {
    const devMode = ["development", "dev"].includes(argv?.mode || "production");
    env = env || {};
    env.production = env.production === true || env.production === "true" || !devMode
    // env.production = false; // force dev mode build
    if (env.production) {
        console.log("Running webpack in production mode");
    } else {
        console.log("Running webpack in development mode");
    }
    return {
        mode: env.production ? "production" : "development",
        devtool: env.production ? undefined : "inline-source-map",
        entry: { editor: "./index.js" },
        output: {
            globalObject: 'self',
            path: path.resolve(__dirname, "output", "monaco", "dist"),
            filename: 'editor.js',
            chunkFilename: '[name].js'
        },
        stats: {
            assets: true,
            children: true,
            chunks: false,
            errors: true,
            errorDetails: true,
            modules: false,
            timings: true,
            colors: true
        },
        target: ['web', 'es6'],
        module: {
            rules: [{
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            }, {
                test: /\.ttf$/,
                type: 'asset/resource'
            }
            ]
        },
        plugins: [
            // As of monaco-editor 0.56.0 the language worker entry files moved from
            // esm/vs/language/<lang>/*_worker.js to esm/vs/languages/features/<lang>/*.worker.js.
            new NormalModuleReplacementPlugin(/monaco-editor-esm-i18n[\\/]esm[\\/]vs[\\/]languages[\\/]features[\\/](json|css|html|typescript)[\\/].*\.worker\.js$/, (resource) => {
                resource.request = resource.request.replace(/monaco-editor-esm-i18n(?=[\\/]esm)/, 'monaco-editor');
            }),
            new MonacoWebpackPlugin({ globalAPI: true, monacoEditorPath: monacoModPath }),
            new LimitChunkCountPlugin({
                maxChunks: 1,
            }),
            new CopyWebpackPlugin({
                patterns: [
                    { from: 'node_modules/monaco-themes/LICENSE', to: "theme" },
                    { from: 'node_modules/monaco-editor-esm-i18n/ThirdPartyNotices.txt', to: "ThirdPartyNotices.txt" },
                    { from: 'node_modules/monaco-editor-esm-i18n/LICENSE', to: "LICENSE", toType: "file" },
                    // Copy each language's locale file into output/locale.
                    // As of monaco-editor 0.56.0 these live at esm/vs/nls/lang/<lang>.js (previously
                    // esm/nls.messages.<lang>.js) and set globalThis._VSCODE_NLS_MESSAGES themselves.
                    {
                        from: 'node_modules/monaco-editor-esm-i18n/esm/vs/nls/lang/*.js',
                        to: ({ context, absoluteFilename }) => {
                            return 'locale/' + path.basename(absoluteFilename);
                        }
                    }
                ]
            }),
            new (class RemoveDuplicatedMonacoWorkersPlugin {
                apply(compiler) {
                    compiler.hooks.afterEmit.tapAsync('RemoveDuplicatedMonacoWorkersPlugin', async (compilation, callback) => {
                        try {
                            const out = compiler.options.output.path;
                            const files = await fs.promises.readdir(out);
                            const targets = files.filter(f => f.startsWith('node_modules_monaco-'));
                            await Promise.all(targets.map(f => fs.promises.unlink(path.join(out, f))));
                        } catch (err) {
                            compilation.warnings.push(new Error('RemoveDuplicatedMonacoWorkersPlugin: ' + (err && err.message || err)));
                        }
                        callback();
                    });
                }
            })(),
        ],

        optimization: {
            minimize: env.production ? true : false,
            chunkIds: 'named',
            runtimeChunk: false,
            splitChunks: false,
        }
    };
};
