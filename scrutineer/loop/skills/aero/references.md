# Reference set

What the agent is shown before it writes an interface. Each block is one technique; `concepts:`
is the retrieval key, and matches the WCAG rule families a spec declares. Blocks are added by
upgrades. The agent starts with almost nothing, which is the point: an interface cannot satisfy a
requirement nobody put in front of it except by luck.

## ref-forms
concepts: labels, names
Every control needs a programmatic name. `<label for="id">` beside `<input id="id">` is the
default; `aria-label` when no visible text exists. Placeholder text is not a label.

## ref-structure
concepts: headings, landmarks
One `<h1>` per document, and heading levels do not skip. Every region of content sits inside a
landmark: `<header>`, `<nav>`, `<main>`, `<footer>`.
