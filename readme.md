<br>

***IMPORTANT NOTE: This project is specifically for building monaco for node-red and will likely not be of much use to any other projects***

<br>

## About 
This project makes an ESM bundle of monaco-editor with 50 themes and localization support. It was built specifically for use in node-red.

## Credits
* Huge credit to [primefaces-monaco](https://github.com/blutorange/primefaces-monaco). Without their work, I would never have gotten i18n working.
* All credits to https://www.npmjs.com/package/monaco-themes for the themes


## Notes
* A bug / issue I had to handle is: when changing mode, html worker would attempt to get links from document, but occasionally `document` would be `null` and an exception would be thrown. This has been handled by adding `if(!document) return []` at the top of `function findDocumentLinks(...)` in file `htmlLinks.js`

## Instructions

### Clone repo
```bash
git clone https://github.com/steve-mcl/monaco-editor-esm-i18n
cd monaco-editor-esm-i18n
```

### Prepare

#### Firstly
* Check & update `package.json` for latest version of `monaco-editor` (check [here](https://www.npmjs.com/package/monaco-editor)) and other dev dependencies
* ~~Update the line `monaco.version = "x.y.z";` in `monaco-editor-esm-i18n.js` to match npm version (This is used in `node-red` for reporting the editor version)~~ This is now done automatically

#### Check + update node-red (function node/server-side) type defs
* `node-red-types/func.d.ts`
* `node-red-types/util.d.ts`

### Build

```bash
npm install
npm run clean
npm run build
```

This will bundle the monaco editor with localization support and themes:

```bash
cd output/monaco/dist/
```

### Check it works

Check editor works in browser...

```bash
npm run demo
```

Now go to

```
http://localhost:8080/demo.html
```

and you should see monaco editor with the monokai theme and French menus (try opening the context menu with a right click)

### Add to node-red src
    cp -r output/monaco/dist \
        <node-red-source-directory>/packages/node_modules/@node-red/editor-client/src/vendor/monaco/

    cp -r output/types \
        <node-red-source-directory>/packages/node_modules/@node-red/editor-client/src/
