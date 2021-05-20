const path = require("path");
const nls = require.resolve("./nls-replace.js");
const LimitChunkCountPlugin = require("webpack/lib/optimize/LimitChunkCountPlugin");
const NormalModuleWebpackReplacementPlugin = require("webpack/lib/NormalModuleReplacementPlugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');
const TerserPlugin = require("terser-webpack-plugin");

module.exports = (env, argv) => {
  env = env || {};
  // env.production = false;
  env.production = env.production === false || env.production === "false" ? false : true;
  if (env.production) {
    console.log("Running webpack in production mode");
  }
  else {
    console.log("Running webpack in development mode");
  }
  return {
    mode: env.production ? "production" : "development",
    devtool: env.production ? undefined : "inline-source-map",
    entry: {
      "editor": "./monaco-editor-esm-i18n.js",
      "editor.worker": "monaco-editor-esm-i18n/esm/vs/editor/editor.worker.js",
      "json.worker": "monaco-editor-esm-i18n/esm/vs/language/json/json.worker",
      "css.worker": "monaco-editor-esm-i18n/esm/vs/language/css/css.worker",
      "html.worker": "monaco-editor-esm-i18n/esm/vs/language/html/html.worker",
      "ts.worker": "monaco-editor-esm-i18n/esm/vs/language/typescript/ts.worker",
    },
    output: {
      globalObject: "this",
      path: path.resolve(__dirname, "output", "monaco", "dist"),
      filename: "[name].js",
    },
    target: ['web', 'es5'],
    module: {
      rules: [
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
        {
          test: /\.ttf$/,
          use: ["url-loader"],
        }
      ]
    },
    plugins: [
      new NormalModuleWebpackReplacementPlugin(/\/(vscode\-)?nls\.js/, function (resource) {
        resource.request = nls;
        resource.resource = nls;
      }),
      new LimitChunkCountPlugin({
        maxChunks: 1,
      }),
      new CopyWebpackPlugin({
        patterns: [
            { from: 'node_modules/monaco-themes/themes', to: "theme"},
            { from: 'node_modules/monaco-themes/LICENSE', to: "theme"},
            { from: 'node_modules/monaco-editor-esm-i18n/ThirdPartyNotices.txt', to: "ThirdPartyNotices.txt"},
            { from: 'node_modules/monaco-editor-esm-i18n/LICENSE', to: "LICENSE", toType: "file"}
        ]
    })
    ],
    optimization: {
      minimize: env.production ? true : false,
      splitChunks: {
        minSize: 9999999999999999,
      },
      minimizer: [
        new TerserPlugin({
          extractComments: false,
        }),
      ],
    }
  };
};
