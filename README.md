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

### Check it works

Check editor works in browser...

```bash
npm run demo
```

Now go to

```
http://localhost:8080/demo.html
```

and you should see monaco editor with a theme set and foreign menus (try opening the context menu with a right click)

### Run the tests

```bash
npm test
```

No build or network needed. It copies the types with `update-types.js` into a temp folder, then checks them the way node-red's Function node editor loads them (one `.d.ts` per module, see `test/fixtures/editor-modules.js`):

* default globals like `Buffer.from()`, `NodeJS.TypedArray`, `node.send()` and `RED.util` resolve to real types, not `any`
* every module in node-red's `knownModules` resolves when added on the Setup tab
* the exclude list in `update-types.js` still matches real files, and nothing it excludes ships
* types that already fail to resolve, and the list of shipped files, match `test/baselines/`

When a version bump changes a baseline on purpose, run `npm run test:update-baseline` and review the diff before committing it.

Other suites:

| Command | What it does | Needs |
| --- | --- | --- |
| `npm run test:build` | clean, full build, then all of the above against `output/`, plus checks on the bundle, workers, locales and themes | network |
| `npm run test:browser` | loads `output/monaco/dist` in headless Chromium: workers run, locales translate, and monaco's TS worker agrees with the tests' type checks | a build, and `npx playwright install chromium` once |
| `npm run test:node-red-sync` | compares `node-red-types/` and `test/fixtures/editor-modules.js` with node-red | `NODE_RED_DIR=../node-red` for a local checkout, or `NODE_RED_REF=<branch>` for GitHub (default `master`) |

If node-red changes `knownModules` or `defaultServerSideTypes` in `monaco.js`, copy the change into `test/fixtures/editor-modules.js`. `npm run test:node-red-sync` tells you when they differ.

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
