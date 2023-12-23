const path = require("path");
const { monacoModDir } = require("./setup");
const monacoModPath = path.resolve(__dirname, "node_modules", monacoModDir);
const nls = require.resolve("./nls-replace.js");
const LimitChunkCountPlugin = require("webpack/lib/optimize/LimitChunkCountPlugin");
const NormalModuleWebpackReplacementPlugin = require("webpack/lib/NormalModuleReplacementPlugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = (env, argv) => {
    env = env || {};
    // env.production = false;
    env.production = env.production === false || env.production === "false" ? false : true;
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
            path: path.resolve(__dirname, "output", "monaco", "dist"),
            filename: 'editor.js'
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
            new NormalModuleWebpackReplacementPlugin(/\/(vscode\-)?nls\.js/, function (resource) {
                resource.request = nls;
                resource.resource = nls;
            }),
            new MonacoWebpackPlugin({ globalAPI: true, monacoEditorPath: monacoModPath }),
            new LimitChunkCountPlugin({
                maxChunks: 1,
            }),
            new CopyWebpackPlugin({
                patterns: [
                    { from: 'node_modules/monaco-themes/LICENSE', to: "theme" },
                    { from: 'node_modules/monaco-editor-esm-i18n/ThirdPartyNotices.txt', to: "ThirdPartyNotices.txt" },
                    { from: 'node_modules/monaco-editor-esm-i18n/LICENSE', to: "LICENSE", toType: "file" }
                ]
            }),
        ],

        optimization: {
            minimize: env.production ? true : false,
            splitChunks: {
                minSize: 9999999999999999,
            }
        }
    };
};
