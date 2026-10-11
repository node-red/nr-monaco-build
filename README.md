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
git clone https://github.com/node-red/nr-monaco-build
cd nr-monaco-build
```

### Prepare

#### Step 1

Prepare the build:

1. Check & update `package.json` for latest version of `monaco-editor` (check [here](https://www.npmjs.com/package/monaco-editor)) and other dev dependencies
2. Update the `package.json` `version` field to match the version of `monaco-editor` you are using.
3. Check + update `setup.js` in particular the node version set in `env.NODE_VERSION_TO_INCLUDE` This should match a version found in [@types/node](https://www.npmjs.com/package/@types/node?activeTab=versions) on NPM e.g. `v20.14.8`

#### Step 2

Check + update node-red (function node/server-side) type defs
* `./node-red-types/func.d.ts`
* `./node-red-types/util.d.ts`

Make type changes here first, or alongside the node-red PR that needs them. `npm run copy` puts them into node-red. If someone changed node-red's copies directly (`editor-client/src/types/node-red/`), bring that change back here before building, or the next copy undoes it. `npm run test:node-red-sync` shows any difference (see [Compare with node-red](#compare-with-node-red)).

### Step 3

Install dependencies, clean and build

```bash
npm install --include=dev
npm run clean
npm run build
```

This will bundle the monaco editor with localization support and themes:

```bash
cd output/monaco/dist/
```

### Check the build before copying it to node-red

The output is vendored into node-red as is, so check it first. A build can succeed and still give node-red types that resolve to `any`, a worker that never loads or a locale that translates nothing, with nothing in the build log.

```bash
npm test               # the types, as node-red's Function node editor loads them (no build needed)
npm run test:build     # clean + build, then everything again against output/, plus bundle, locale and theme checks
npm run test:browser   # the built editor in headless Chromium (run `npx playwright install chromium` once)
```

`npm test` loads the types the way node-red's `monaco.js` does: one `.d.ts` per module, from the list in `test/fixtures/editor-modules.js`. It checks:

* default globals like `Buffer.from()`, `NodeJS.TypedArray`, `node.send()` and `RED.util` resolve to real types, not `any`
* every module in node-red's `knownModules` resolves when added on the Setup tab
* the exclude list in `update-types.js` still matches real files, and nothing it excludes ships
* types that already fail to resolve, and the list of shipped files, match `test/baselines/`

If a bump changes which files node-red has to load (for example @types/node 24 moved `Buffer.from()` into `buffer.buffer.d.ts`), the tests fail on whatever turned into `any`. Update `knownModules`/`defaultServerSideTypes` in node-red's `monaco.js` in a node-red PR alongside this one, and make the same change in `test/fixtures/editor-modules.js`.

When a bump changes a baseline on purpose, run `npm run test:update-baseline` and review the diff before committing it.

#### Compare with node-red

```bash
NODE_RED_DIR=../node-red npm run test:node-red-sync   # a local checkout, on whatever branch it is on
NODE_RED_REF=dev npm run test:node-red-sync           # or a branch/tag on GitHub (default master)
```

Compares `node-red-types/` with node-red's copies, to catch changes made directly in node-red that need bringing back here. Also compares `test/fixtures/editor-modules.js` with the `monaco.js` this build is going into. Differences are expected while the matching node-red PR is still open.

#### Check it by eye

Check editor works in browser...

```bash
npm run demo
```

Now go to

```
http://localhost:8080/demo.html
```

and you should see monaco editor with a theme set and foreign menus (try opening the context menu with a right click)

### Add to node-red src

#### Automatically

If your Node-RED source is relative to this repo, you can run the following helper script:

```bash
npm run copy
```

#### Manually

When your Node-RED source is not relative to this repo, you can copy the files manually:

```bash
# Set the path to your node-red source e.g.
export nr_src=~/repos/github/node-red-org/node-red
# clean up
rm -rf $nr_src/packages/node_modules/@node-red/editor-client/src/vendor/monaco/dist/*
rm -rf $nr_src/packages/node_modules/@node-red/editor-client/src/types/node/*
rm -rf $nr_src/packages/node_modules/@node-red/editor-client/src/types/node-red/*

# copy
cp -r output/monaco/dist \
    $nr_src/packages/node_modules/@node-red/editor-client/src/vendor/monaco/
cp -r output/types \
    $nr_src/packages/node_modules/@node-red/editor-client/src/

```

### Additional helper scripts

#### Build monaco in development mode

```bash
npm run build-dev
```


#### All in one (production mode)

This will run `npm run clean`,  `npm run build`, `npm run copy` in sequence

```bash
npm run all
```

#### All in one (development mode)

This will run `npm run clean`,  `npm run build-dev`, `npm run copy` in sequence

```bash
npm run all-dev
```
