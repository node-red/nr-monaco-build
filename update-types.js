
const minify = false; //SET ME AS REQUIRED

const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf')
const {exec} = require('child_process');
const note = `\n/* NOTE: Do not edit directly! This file is generated using \`npm run update-types\` in https://github.com/Steve-Mcl/monaco-editor-esm-i18n */\n\n`;
const excludeLibs = ["base.d.ts","constants.d.ts","index.d.ts","inspector.d.ts","punycode.d.ts", "globals.global.d.ts", "repl.d.ts"];
const { createMinifier } = require("dts-minify");

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
	nodeVer = nodeVer.replace("v","");
	nodeVer = "14.60.20"
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
			importLibs(NODE_LIB_SOURCE, NODE_LIB_DESTINATION);
			copyFiles(NODE_RED_LIB_SOURCE, NODE_RED_LIB_DESTINATION);
		});
	});	
})();


function importLibs(src, dst) {
	deleteFileOrDir(dst);
	copyFiles(src, dst);
}

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
	if(nodeDtsFiles && nodeDtsFiles.length) {
		var files = nodeDtsFiles.filter(e => excludeLibs.includes(e) == false);//remove excluded files
		if(files.length) {
			console.log(`Copy '${files.length}' file(s) from '${src}' to '${dst}'...`)
			try {
				fs.statSync(dst);
			} catch (err) {
				fs.mkdirSync(dst, { recursive: true });
			}
			while (files.length > 0) {
				const name = files.shift();
				console.log(`Copying '${name}'`)
				const output = note + readLibFile(name, src).replace(/\r\n/g, '\n');
				if(minify) {
					const minifiedText = minifier.minify(output, {
						keepJsDocs: true, // false by default
					});
					fs.writeFileSync(path.join(dst, name), minifiedText );
				} else {
					fs.writeFileSync(path.join(dst, name), output );
				}
				
			}
		}
	}
	const dirs = getDirectories(src);
	if(dirs && dirs.length) {
		for (let index = 0; index < dirs.length; index++) {
			const p = dirs[index];
			var srcDir = path.join(src, p);
			var dstDir = path.join(dst, p);
			copyFiles(srcDir, dstDir);
		} 
	}
}

function findClosestSemverMatch(semverString, semverStringArray) {
	if (!semverStringArray.length) {
	  return null
	}
  
	const semvers = semverStringArray.map(e => semver(e));
	semvers.sort(function(a, b){
		if(a.major < b.major) return -1;
		else if(a.major > b.major) return 1;
		else {
		  if(a.minor < b.minor) return -1;
		  else if(a.minor > b.minor) return 1;
		  else {
			if(a.revision < b.revision) return -1;
			else if(a.revision > b.revision) return 1;
		  }
		}
	  });

	const semverB = semver(semverString)
	const offsets = semvers.map(semverA => {
	  return Math.abs(
		(semverA.major * 100 + semverA.minor * 10 + semverA.patch) -
		(semverB.major * 100 + semverB.minor * 10 + semverB.patch)
	  )
	})
  
	const minOffset = Math.min.apply(null, offsets)
	const pos = offsets.indexOf(minOffset);
	const closest = semvers[pos];
	return closest.toString();
}

function semver(ver) {
	var splitVersionNum = ver.split('.');
	var versionObj = {};
	switch(splitVersionNum.length){
		case 1:
		versionObj = {
			"major":parseInt(splitVersionNum[0]),
			"minor":0,
			"patch":0
		};
		break;
		case 2:
		versionObj = {
			"major":parseInt(splitVersionNum[0]),
			"minor":parseInt(splitVersionNum[1]),
			"patch":0
		};
		break;
		case 3:
		versionObj = {
			"major":parseInt(splitVersionNum[0]),
			"minor":parseInt(splitVersionNum[1]),
			"patch":parseInt(splitVersionNum[2])
		};
	}
	versionObj.toString = function() {
		return `${this.major}.${this.minor}.${this.patch}`;
	}
	return versionObj;
}

//this is deliberately long hand since rmdirSync did not support .recursive {option} until v12.10.0
function deleteFileOrDir(_path){
	if (fs.existsSync(_path)) {
		if (fs.lstatSync(_path).isDirectory()) {
			var files = fs.readdirSync(_path);
			if (!files.length) return fs.rmdirSync(_path);
			for (var file in files) {
				var currentPath = path.join(_path, files[file]);
				if (!fs.existsSync(currentPath)) continue;
				if (fs.lstatSync(currentPath).isFile()) {
					fs.unlinkSync(currentPath);
					continue;
				}
				if (fs.lstatSync(currentPath).isDirectory() && !fs.readdirSync(currentPath).length) {
					fs.rmdirSync(currentPath);
				} else {
					deleteFileOrDir(currentPath, _path);
				}
			}
			deleteFileOrDir(_path);
		} else {
			fs.unlinkSync(_path);
		}
	}
}