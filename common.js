const fs = require('fs');
const path = require('path');
const _semver = require("semver");

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