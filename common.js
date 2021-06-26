const fs = require('fs');
const path = require('path');
const _semver = require("semver");

function findClosestSemverMatch(semverString, semverStringArray) {
	if (!semverStringArray.length) {
	  return null
	}
	let semversArray = semverStringArray.map(e => semver(e));
	const semverB = semver(semverString);
	const semversSameMajor = semversArray.filter(e => e.major == semverB.major);
	if(semversSameMajor && semversSameMajor.length) {
		semversArray = semversSameMajor;
	}
	semversArray.sort(function(a, b){
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

	let below, above, best;
	for (let index = 0; index < semversArray.length; index++) {
		const element = semversArray[index];
		if(element.major == semverB.major && element.minor == semverB.minor && element.patch == semverB.patch) {
			best = element;
			break;
		}
		if(element.major <= semverB.major && element.minor <= semverB.minor && element.patch < semverB.patch) {
			below = element;
		}
		if(element.major >= semverB.major && element.minor >= semverB.minor && element.patch > semverB.patch) {
			above = element;
			break;
		}
	}
	if(!best) {
		best = above ? above : below;
	}
	if(!best) {
		return null;
	}

	return best.toString();
}

function semver(/** @type {string} */ ver) {
    let verClean = (ver+"");
    verClean = verClean.replace(">","").replace("<","").replace("^","").replace("~","").replace("=","");
	const parts = verClean.split('.');
	if(parts.length === 1) parts.push("0");
	if(parts.length === 2) parts.push("0");
	if(parts.length > 3) {
        parts[2] = parts.slice(2).join(".");
    }

	const p1 = ((parts[0] + "") || "0").trim();
	const p2 = ((parts[1] + "") || "0").trim();
	const p3 = ((parts[2] + "") || "0").trim();
    const version = _semver.parse(`${p1}.${p2}.${p3}`);

	return version;
}

function mkDirSafe(dst) {
    try {
        fs.statSync(dst);
    } catch (err) {
        fs.mkdirSync(dst, { recursive: true });
    }
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

exports.findClosestSemverMatch = findClosestSemverMatch;
exports.semver = semver;
exports.deleteFileOrDir = deleteFileOrDir;
exports.mkDirSafe = mkDirSafe;