# Build a saved archive with Astro and Pagefind

`site:build:directory` is the active presentation command. It reads the current
schema-2 manifest and body-only Markdown, uses native Astro configuration/build
and the installed lockfile-pinned Pagefind CLI, and leaves persistence and native
Pages deployment to Actions or the operator. See the [production runbook](v2-production-cutover.md).
#24's historical hosted acceptance remains separate.

Install dependencies separately using Node 22.22 and `npm ci`. Then run:

```sh
npm run --silent site:build:directory -- \
  --archive-dir /path/to/saved-archive \
  --output /path/to/fresh-site \
  --base /copilot-changelog-mirror/ \
  --site https://example.github.io
```

`--archive-dir` and `--output` are required. `--base` defaults to
`/copilot-changelog-mirror/`; `/` supports root hosting. `--site` is optional and
accepts an HTTP(S) origin without credentials, path, query or fragment. Installation,
Git persistence, capture, offline Render, upload and deployment belong to callers.
The archive may be a checkout or saved export; this operation requires no Git
branch or clean-index protocol.

Every manifest article must have canonical title/time/route and a readable UTF-8
`posts/<article_id>.md`. A newly captured null canonical record rejects the whole
build; finish offline Render before republishing. Missing state/bodies, invalid
schema/identities/canonical fields, route collisions or mismatches, frontmatter,
and symlink/nonregular managed paths fail. The adapter reads only metadata and
required bodies. It neither traverses snapshots nor fetches media nor rechecks raw
integrity; Capture/Render and migration audits own those checks.

Output must be fresh and outside both archive and application inputs, with no
ancestor/descendant overlap or symlink aliases. An existing output is preserved
and rejected. Use a new path per invocation. Adapter data, Astro generated types,
cache and build/index intermediates live in a temporary sibling directory, named
`.copilot-native-incomplete-*`; dependencies are referenced from the installed
application. There is no source-copy/closure-selection system. After both tools
finish, the command exclusively reserves the final directory and promotes the
artifact. It cleans its temporary directory on ordinary failures. Cleanup errors warn on
stderr while preserving the completed result or original stage diagnostic.

Tool logs go to stderr. Success writes one JSON result with `outcome: "success"`,
absolute `output`, `article_count`, and adapter/Astro/Pagefind elapsed timings.
Failure returns nonzero and JSON with `outcome: "failure"` and an actionable
`diagnostic`, without an output/success claim. Partially built data is never
promoted. For an empty publication, the real locked Pagefind 1.5.2 CLI returns its
specific zero-file/zero-page/no-index outcome with exit 1; that precise outcome is
handled explicitly. Other failures, including an invalid CLI option on an empty
corpus, remain failures. The empty listing has no search control or index.

The listing retains descending canonical UTC ordering, identity ties and unknown
times last. Titles own the editorial H1; dates never fall back to discovery or
modification time. `/posts/<slug>/`, source attribution, body order, anchors and
external media remain intact. Generated heading IDs are disambiguated when they
would duplicate explicit archive anchors; explicit canonical fragment IDs remain usable.
The configured base covers internal navigation, assets and search result URLs.

Search scans only fresh `posts/**/*.html` with native article-body inclusion and
provenance exclusion. Pagefind's maintained UI owns queries, results, excerpts,
continuation and section subresults. A small adapter addresses demonstrated gaps
in the installed classic UI: its input lacks an accessible label; visible state
messages lack a live region; initialization can leave rejected promises; some
failed shards can masquerade as no matches. The adapter adds a label/live status,
observes only local search-asset failures, and leaves a readable browse fallback.
It uses Pagefind's supported `noWorker` option to make those fetch failures
observable. The ordinary listing works without JavaScript and throughout search
failure.

See [final test ownership](v2-cleanup-tests.md) and the retained
[original-corpus comparison](v2-native-site-comparison.json). After dependency
and Chromium installation, focused verification is:

```sh
node --import tsx --test tests/v2/native-site.test.ts
node --import tsx --test tests/v2/native-site.browser.ts
```

Cheap input/safety and actual compiler/indexer/completion failures run in `npm test`.
One primary source-to-Render-to-build artifact is shared by DOM/browser checks;
changed and empty publications get their own necessary builds. These run in
`npm run test:browser`. The historical full-corpus runners and frozen sources are
recoverable from Git rather than active regular-suite fixtures; retrieval is
documented in `tests/fixtures/production/README.md`.
