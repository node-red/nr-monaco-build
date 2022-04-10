/*
    Generates monaco compatible themes from tm themes and renames the file to that of 
*/
const path = require('path');
const parseTmTheme = require('monaco-themes').parseTmTheme;
const fs = require('fs');

const exclude = ["themelist.json"];
const SOURCE1 = path.join(__dirname, 'node_modules/monaco-themes/themes');
const SOURCE2 = path.join(__dirname, 'theme-extra');
const DESTINATION = path.join(__dirname, 'output/monaco/dist/theme');



(function () {
    try {
        fs.statSync(DESTINATION);
    } catch (err) {
        fs.mkdirSync(DESTINATION, { recursive: true });
    }
    importThemes(SOURCE1, DESTINATION);
    importThemes(SOURCE2, DESTINATION);
})();


function importThemes(source, destination) {
    function readFile(name, dir) {
        const srcPath = path.join(dir, name);
        return fs.readFileSync(srcPath).toString();
    }

    function getNewFileName(src) {
        let newName = src.toLowerCase();
        if (newName.endsWith(".tmtheme")) {
            newName = newName.replace(".tmtheme", ".json")
        }
        newName = newName.split(" ").join("-");
        newName = newName.split("[").join("");
        newName = newName.split("]").join("");
        newName = newName.split("(").join("");
        newName = newName.split(")").join("");
        return newName
    }

    const themeFiles = fs.readdirSync(source);
    while (themeFiles.length > 0) {
        const srcFileName = themeFiles.shift();
        let skip = exclude.includes(srcFileName);
        if (skip) continue;

        let tmThemeString = readFile(srcFileName, source);
        var themeData = tmThemeString;
        let dstFileName = srcFileName;
        if (dstFileName.toLowerCase().endsWith(".json")) {
            dstFileName = getNewFileName(srcFileName);
        } else if (dstFileName.toLowerCase().endsWith(".tmtheme")) {
            dstFileName = getNewFileName(srcFileName);
            let monacoTheme = parseTmTheme(tmThemeString);
            themeData = JSON.stringify(monacoTheme, null, 2);
        }
        console.log(`Adding ${srcFileName} as ${dstFileName}`)
        fs.writeFileSync(path.join(destination, dstFileName), themeData);
    }

}
