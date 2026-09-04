#!/usr/bin/env node
/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * docs.mjs: The generated reference documentation's own build steps - the clean a render starts from, and the check a publish runs.
 *
 * Subcommands:
 *
 *   clean    rm -rf every generated entry under docs/, silently ignoring missing ones, so a render never inherits a page the current source does not produce (invoked
 *            by the `build-docs` npm script).
 *   check    verify that the committed pages are what this source renders under the declared renderer, reporting a version mismatch and stale documentation as
 *            two distinct findings (invoked by `check-docs`, and by `prepublishOnly` before a publish).
 */
import { join, relative } from "node:path";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

/* Every entry `npm run build-docs` regenerates. One list serves both verbs, so the clean step and the check can never disagree about which pages are generated
 * and a page can never be cleaned without also being checked.
 *
 * Everything else under docs/ - Changelog.md, Overview.md, and .nojekyll - is hand-maintained, and is outside this list by construction: it is neither removed
 * nor compared. docs/modules is a member the current renderer never writes, which costs nothing: an entry absent from both the committed tree and a fresh render
 * compares equal, and listing it means a renderer that starts writing it is cleaned and checked from the first run.
 */
const GENERATED = [ "docs/classes", "docs/functions", "docs/interfaces", "docs/modules", "docs/type-aliases", "docs/variables", "docs/README.md" ];

// The renderer and the markdown plugin that shapes its output, named here so the pin check reads the same two packages a docs build runs under.
const RENDERERS = [ "typedoc", "typedoc-plugin-markdown" ];

// The directory the committed pages live under, which is also what a scratch render's own root stands in for when the two trees are compared entry by entry.
const DOCS_ROOT = "docs";

// Remove every generated entry so a render starts from a clean tree. `rm` with `force` already silences ENOENT, so an entry the renderer never writes is a no-op
// rather than an error, matching POSIX `rm -f` semantics.
async function clean() {

  await Promise.all(GENERATED.map((path) => rm(path, { force: true, recursive: true })));
}

/* Whether the renderer about to run is the one package.json declares, answered as the list of packages that disagree.
 *
 * A render under a different plugin version re-wraps pages no source change touched, so a comparison run under a floated renderer reports churn that says nothing
 * about the source. Answering this before anything is rendered is what keeps the check's two findings distinct: past this point, a stale verdict always means the
 * source moved.
 */
async function rendererMismatches() {

  const manifest = JSON.parse(await readFile("package.json", "utf8"));

  const resolved = await Promise.all(RENDERERS.map(async (name) => ({

    declared: manifest.devDependencies[name],
    name,
    resolved: JSON.parse(await readFile(join("node_modules", name, "package.json"), "utf8")).version
  })));

  return resolved.filter((pin) => pin.declared !== pin.resolved);
}

// Every file under one entry, as paths relative to that entry. An entry that does not exist answers with an empty list, which is what lets a member neither side
// carries compare equal; an entry that is itself a file answers with the single empty path, standing for the entry.
async function filesUnder(root) {

  let entry;

  try {

    entry = await stat(root);
  } catch(error) {

    if(error.code === "ENOENT") {

      return [];
    }

    throw error;
  }

  if(entry.isFile()) {

    return [""];
  }

  const found = [];

  const walk = async (dir) => {

    for(const item of await readdir(dir, { withFileTypes: true })) {

      const path = join(dir, item.name);

      if(item.isDirectory()) {

        await walk(path);

        continue;
      }

      found.push(relative(root, path));
    }
  };

  await walk(root);

  return found;
}

// Resolve one of the relative paths `filesUnder` answers with back to a real path. The empty path stands for the entry itself, which is how a single-file entry
// such as docs/README.md reads the same way a directory's members do.
function pathOf(root, path) {

  return (path.length > 0) ? join(root, path) : root;
}

/* Compare a fresh render against the committed pages, entry by entry, and answer what differs.
 *
 * The comparison is byte-for-byte rather than by modification time or size, because the whole question is whether the committed bytes are what this source
 * produces. A page one side alone carries is an addition or a removal; a page both carry whose bytes differ is a change.
 */
async function compare(rendered) {

  const added = [];
  const changed = [];
  const removed = [];
  let compared = 0;

  for(const entry of GENERATED) {

    const mirror = join(rendered, relative(DOCS_ROOT, entry));
    const committedFiles = new Set(await filesUnder(entry));
    const renderedFiles = new Set(await filesUnder(mirror));

    for(const path of renderedFiles) {

      if(!committedFiles.has(path)) {

        added.push(pathOf(entry, path));
      }
    }

    for(const path of committedFiles) {

      if(!renderedFiles.has(path)) {

        removed.push(pathOf(entry, path));

        continue;
      }

      const [ committedBytes, renderedBytes ] = await Promise.all([ readFile(pathOf(entry, path)), readFile(pathOf(mirror, path)) ]);

      compared++;

      if(!committedBytes.equals(renderedBytes)) {

        changed.push(pathOf(entry, path));
      }
    }
  }

  return { added, changed, compared, removed };
}

// Print one finding list, sorted so a run reads the same way twice.
function report(label, paths) {

  for(const path of paths.sort()) {

    process.stderr.write(label + " " + path + "\n");
  }
}

/* Verify the committed pages against a fresh render, and answer the exit code the caller should end on.
 *
 * The scratch render lives under the system temp directory and is removed in a `finally`, so a failed render leaves nothing behind. The exit code is returned
 * rather than taken here, because `process.exit` would skip that cleanup.
 */
async function check() {

  const mismatches = await rendererMismatches();

  if(mismatches.length > 0) {

    for(const pin of mismatches) {

      process.stderr.write("The documentation renderer " + pin.name + " is declared as " + pin.declared + " but resolves to " + pin.resolved +
        ", so a render would not reproduce the committed pages.\n");
    }

    return 1;
  }

  const rendered = await mkdtemp(join(tmpdir(), "unifi-access-docs-"));

  try {

    const render = spawnSync("npx", [ "typedoc", "--out", rendered ], { stdio: "inherit" });

    if(render.status !== 0) {

      process.stderr.write("The documentation renderer exited with status " + String(render.status) + ", so the committed pages could not be checked.\n");

      return 1;
    }

    const { added, changed, compared, removed } = await compare(rendered);

    if((added.length + changed.length + removed.length) === 0) {

      process.stdout.write("The committed documentation matches its source across " + String(compared) + " pages.\n");

      return 0;
    }

    report("Added:", added);
    report("Changed:", changed);
    report("Removed:", removed);
    process.stderr.write("The committed documentation is stale against its source. Run \"npm run build-docs\" and commit the result.\n");

    return 1;
  } finally {

    await rm(rendered, { force: true, recursive: true });
  }
}

const [command] = process.argv.slice(2);

switch(command) {

  case "check": {

    process.exitCode = await check();

    break;
  }

  case "clean": {

    await clean();

    break;
  }

  default: {

    process.stderr.write("Usage: docs.mjs {check | clean}\n");
    process.exitCode = 1;

    break;
  }
}
