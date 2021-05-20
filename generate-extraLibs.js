/*
	Generates a single file containing monacoExtraLibs with an index lookup and the types as strings in a lookup
	This version IS NOt USED - but could be utilised at a later date. 
	Worth keeping this code for "just in case"
*/
const path = require('path');
const fs = require('fs');
const child_process = require('child_process');
const note = `\n/* NOTE: Do not edit directly! This file is generated using \`npm run generate-extraLibs\` */\n`;
const enableDefault = ["console.d.ts", "globals.d.ts", "buffer.d.ts", "red-util.d.ts", "red-func.d.ts"];
const excludeLibs = ["base.d.ts","constants.d.ts","index.d.ts","inspector.d.ts","punycode.d.ts", "globals.global.d.ts", "repl.d.ts"];
const NODE_LIB_SOURCE = path.join(__dirname, 'node_modules/@types/node');
const NODE_RED_LIB_SOURCE = path.join(__dirname, 'node-red-types');
const LIB_DESTINATION = path.join(__dirname, 'output/types/extraLibs');

(function () {
	try {
		fs.statSync(LIB_DESTINATION);
	} catch (err) {
		fs.mkdirSync(LIB_DESTINATION, { recursive: true });
	}
	importLibs();
	
})();


function importLibs() {
	function readLibFile(name, dir) {
		const srcPath = path.join(dir, name);
		return fs.readFileSync(srcPath).toString();
	}

	let strLib = `${note}
/** default export */
export const monacoExtraLibs = {}
`;

	let strLibResult = `${note}
/** lib files */
monacoExtraLibs.typeMap = {}
`;

	let strIndexResult = `${note}
/** lib index */
monacoExtraLibs.typeSet = {}
`;
	const nodeDtsFiles = fs.readdirSync(NODE_LIB_SOURCE).filter((f) => f.includes('.ts'));
	while (nodeDtsFiles.length > 0) {
		const name = nodeDtsFiles.shift();
		let skip = excludeLibs.includes(name);
		if(skip) continue;
		console.log(`Adding ${name}`)
		const output = readLibFile(name, NODE_LIB_SOURCE).replace(/\r\n/g, '\n');
		strLibResult += `monacoExtraLibs.typeMap['node/${name}'] = "${escapeText(output)}";\n`;
		let en = enableDefault.includes(name);
		strIndexResult += `monacoExtraLibs.typeSet['node/${name}'] = ${en};\n`;
	}
	const noderedDtsFiles = fs.readdirSync(NODE_RED_LIB_SOURCE).filter((f) => f.includes('.ts'));
	while (noderedDtsFiles.length > 0) {
		const name = noderedDtsFiles.shift();
		let skip = excludeLibs.includes(name);
		if(skip) continue;
		console.log(`Adding ${name}`)
		const output = readLibFile(name, NODE_RED_LIB_SOURCE).replace(/\r\n/g, '\n');
		strLibResult += `monacoExtraLibs.typeMap['red/${name}'] = "${escapeText(output)}";\n`;
		strIndexResult += `monacoExtraLibs.typeSet['red/${name}'] = true;\n`;
	}

	fs.writeFileSync(path.join(LIB_DESTINATION, 'extraLibs.js'), strLib + strIndexResult + strLibResult );
}

/**
 * Escape text such that it can be used in a javascript string enclosed by double quotes (")
 */
function escapeText(text) {
	// See http://www.javascriptkit.com/jsref/escapesequence.shtml
	const _backspace = '\b'.charCodeAt(0);
	const _formFeed = '\f'.charCodeAt(0);
	const _newLine = '\n'.charCodeAt(0);
	const _nullChar = 0;
	const _carriageReturn = '\r'.charCodeAt(0);
	const _tab = '\t'.charCodeAt(0);
	const _verticalTab = '\v'.charCodeAt(0);
	const _backslash = '\\'.charCodeAt(0);
	const _doubleQuote = '"'.charCodeAt(0);

	const len = text.length;
	let startPos = 0;
	let chrCode;
	let replaceWith = null;
	let resultPieces = [];

	for (let i = 0; i < len; i++) {
		chrCode = text.charCodeAt(i);
		switch (chrCode) {
			case _backspace:
				replaceWith = '\\b';
				break;
			case _formFeed:
				replaceWith = '\\f';
				break;
			case _newLine:
				replaceWith = '\\n';
				break;
			case _nullChar:
				replaceWith = '\\0';
				break;
			case _carriageReturn:
				replaceWith = '\\r';
				break;
			case _tab:
				replaceWith = '\\t';
				break;
			case _verticalTab:
				replaceWith = '\\v';
				break;
			case _backslash:
				replaceWith = '\\\\';
				break;
			case _doubleQuote:
				replaceWith = '\\"';
				break;
		}
		if (replaceWith !== null) {
			resultPieces.push(text.substring(startPos, i));
			resultPieces.push(replaceWith);
			startPos = i + 1;
			replaceWith = null;
		}
	}
	resultPieces.push(text.substring(startPos, len));
	return resultPieces.join('');
}

function stripSourceMaps(str) {
	return str.replace(/\/\/# sourceMappingURL[^\n]+/gm, '');
}
