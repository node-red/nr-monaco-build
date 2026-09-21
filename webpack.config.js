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
            new NormalModuleReplacementPlugin(/monaco-editor-esm-i18n\/esm\/vs\/language\/(json|css|html|typescript)\/.*_worker.js$/, (resource) => {
                resource.request = resource.request.replace('monaco-editor-esm-i18n/esm', 'monaco-editor/esm');
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
                    // Copy all nls.messages.*.js files into output/locale and strip the leading "nls.messages." from the filename
                    {
                        from: 'node_modules/monaco-editor-esm-i18n/esm/nls.messages.*.js',
                        to: ({ context, absoluteFilename }) => {
                            // targetPath will be like 'nls.messages.en.js' - remove the prefix
                            const base = path.basename(absoluteFilename);
                            return 'locale/' + base.replace(/^nls\.messages\./, '');
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
