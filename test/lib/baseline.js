/**
 * Committed JSON baselines under test/baselines/.
 *
 * A check fails on any difference in either direction: new entries are regressions, and missing
 * entries mean the baseline is stale and should be refreshed so it keeps catching regressions.
 * Run with UPDATE_BASELINE=1 (`npm run test:update-baseline`) to rewrite the files, then review
 * the git diff.
 */
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "baselines");

/** @param {string} name @param {Record<string, string[]>} actual */
function check(name, actual) {
    const file = path.join(dir, name);
    if (process.env.UPDATE_BASELINE) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, JSON.stringify(actual, null, 4) + "\n");
        return;
    }
    assert.ok(fs.existsSync(file), `${name} is missing. Create it with \`npm run test:update-baseline\``);
    const expected = JSON.parse(fs.readFileSync(file, "utf8"));
    const lines = [];
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
        const exp = expected[key] || [];
        const act = actual[key] || [];
        const added = act.filter((x) => !exp.includes(x));
        const removed = exp.filter((x) => !act.includes(x));
        if (!(key in actual)) lines.push(`  ${key}: no longer checked`);
        if (!(key in expected)) lines.push(`  ${key}: not in the baseline`);
        added.forEach((x) => lines.push(`  + ${key}: ${x}`));
        removed.forEach((x) => lines.push(`  - ${key}: ${x}`));
    }
    assert.ok(lines.length === 0, [
        `${name} does not match (+ new, - gone):`,
        ...lines,
        "If the change is expected, run `npm run test:update-baseline` and commit the diff.",
    ].join("\n"));
}

module.exports = { check };
