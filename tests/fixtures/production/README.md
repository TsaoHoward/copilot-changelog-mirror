# Captured Changelog regression corpus

The six HTML files are byte-for-byte copies of persisted `mirror-data/snapshots/`
at commit `c3c50e345ad8f5c8eddd504b7934c6cc30f8dcfb`. Tests use these saved inputs
without network access. Each JSON baseline records its original path, source URL,
capture time, and SHA-256 digest.

The corpus contains all four production regressions named in issue #8, the short
Agentic autofix control, and the longer Dynamic workflows article. Inspection of
all ten available captures found the editorial body in
`.PostContent-main.editorial-content-block`, with the generated responsive TOCs
in sibling `.PostContent-aside` elements. The `js-table-of-contents-source` class
marks editorial content, not a TOC. Nested HTML/body wrappers in the captures
are intentional and preserved in the fixtures.

The JSON files freeze 123 ordered editorial blocks: all nonempty paragraphs,
list items, and section headings from the six reviewed bodies. These include the
beginning, middle, and end of each article. The plain-text oracle normalizes only
whitespace and HTML entities; the Markdown oracle stores literal formatting from
the corresponding source blocks, omitting list and heading prefixes so it can
check text independently of numbering and self-link anchors. The baselines are
static test data, never recomputed by the production extractor during tests.

The title, section sequence, lists, emphasis, external links, meaningful lead
images, and embedded video are also recorded. Empty decorative lead images
marked `aria-hidden` and layout placeholder SVGs are chrome, while images with
useful alternative text remain article content. Header date/type/read-time
framing, sidebar TOCs, share controls, and back-to-changelog navigation are
outside the editorial body. "Share your feedback" is a substantive section and
"Shared organization and enterprise skills" is substantive list text.

The older synthetic fixture is supplemental coverage for code blocks and emoji
anchors absent from this capture corpus; it does not define the production DOM
or the content-preservation oracle. Update these baselines only after reviewing
the captured editorial content, never to match a parser's shortened output.
