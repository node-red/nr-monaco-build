
const minify = false; //SET ME AS REQUIRED

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const note = `\n/* NOTE: Do not edit directly! This file is generated using \`npm run update-types\` in https://github.com/Steve-Mcl/monaco-editor-esm-i18n */\n\n`;
const excludeLibs = ["base.d.ts", "constants.d.ts", "index.d.ts", "inspector.d.ts", "punycode.d.ts", "globals.global.d.ts", "repl.d.ts"];
const { createMinifier } = require("dts-minify");
const { findClosestSemverMatch, deleteFileOrDir, mkDirSafe } = require("./common");

let ts, minifier;
if (minify) {
    ts = require("typescript");
    minifier = createMinifier(ts);// setup (provide a TS Compiler API object)
}


const {
    NODE_LIB_SOURCE,
    NODE_LIB_DESTINATION,
    NODE_RED_LIB_SOURCE,
    NODE_RED_LIB_DESTINATION
} = require("./paths");


(function () {
    var nodeVer = process.version;
    nodeVer = nodeVer.replace("v", "");
    nodeVer = "16.60.20"
    //get available nodejs types from npm
    var cmd1 = `npm view @types/node  versions  --json`;
    exec(cmd1, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing '${cmd2}': ${error}`);
            process.exit(-1); //npm view error
        }
        //determine closes version
        var versions = JSON.parse(stdout);
        var closestVersion = findClosestSemverMatch(nodeVer, versions);

        //install @types/node@closestVersion
        var cmd2 = `npm i -s @types/node@${closestVersion} --save-dev`;
        exec(cmd2, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing '${cmd2}': ${error}`);
                process.exit(-2); //npm install error
            }
            //import the libs from NODE_LIB_SOURCE to NODE_LIB_DESTINATION
            deleteFileOrDir(NODE_LIB_DESTINATION);
            deleteFileOrDir(NODE_RED_LIB_DESTINATION);
            copyFiles(NODE_LIB_SOURCE, NODE_LIB_DESTINATION);
            copyFiles(NODE_RED_LIB_SOURCE, NODE_RED_LIB_DESTINATION);
        });
    });
})();


function copyFiles(src, dst) {
    function readLibFile(name, dir) {
        const srcPath = path.join(dir, name);
        return fs.readFileSync(srcPath).toString();
    }
    function getDirectories(_path) {
        return fs.readdirSync(_path).filter(function (file) {
            return fs.statSync(path.join(_path, file)).isDirectory();
        });
    }
    const nodeDtsFiles = fs.readdirSync(src).filter((f) => f.includes('.ts'));
    if (nodeDtsFiles && nodeDtsFiles.length) {
        var files = nodeDtsFiles.filter(e => excludeLibs.includes(e) == false);//remove excluded files
        if (files.length) {
            console.log(`Copy '${files.length}' file(s) from '${src}' to '${dst}'...`)
            mkDirSafe(dst);
            while (files.length > 0) {
                const name = files.shift();
                console.log(`Copying '${name}'`)
                const output = note + readLibFile(name, src).replace(/\r\n/g, '\n');
                if (minify) {
                    const minifiedText = minifier.minify(output, {
                        keepJsDocs: true, // false by default
                    });
                    fs.writeFileSync(path.join(dst, name), minifiedText);
                } else {
                    fs.writeFileSync(path.join(dst, name), output);
                }

            }
        }
    }
    const dirs = getDirectories(src);
    if (dirs && dirs.length) {
        for (let index = 0; index < dirs.length; index++) {
            const p = dirs[index];
            var srcDir = path.join(src, p);
            var dstDir = path.join(dst, p);
            copyFiles(srcDir, dstDir);
        }
    }
}
