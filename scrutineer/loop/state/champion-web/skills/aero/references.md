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

## ref-dialogs
concepts: dialogs, keyboard, names
A modal is `role="dialog" aria-modal="true"` with `aria-labelledby` pointing at its own heading.
Focus moves into the dialog on open, is trapped while it is open, Escape closes it, and focus
returns to the control that opened it. Content behind it is `inert` or `aria-hidden="true"`.

## ref-keyboard
concepts: keyboard, names
Every interactive element is reachable and operable by keyboard. Use real `<button>`/`<a href>`
rather than clickable `<div>`s; if a custom widget is unavoidable it needs `tabindex="0"`, a
`role`, and Enter/Space handlers. Never remove the focus outline without replacing it.

## ref-contrast
concepts: contrast
Body text needs 4.5:1 against its background, large text (18.66px bold or 24px) 3:1, and UI
component boundaries and focus indicators 3:1. Placeholder and disabled-looking greys on white
are the usual failure; darken to at least #595959 on #ffffff.

## ref-tables
concepts: tables, headings
Data tables use `<table>` with a `<caption>`, `<thead>`, and `<th scope="col">`/`<th scope="row">`
on every header cell. A sortable column header carries `aria-sort="ascending|descending|none"`
on the `<th>`, and the sort control is a `<button>` inside that `<th>`.

## ref-images
concepts: images
Every `<img>` has an `alt`. Informative images describe the information; decorative images take
`alt=""` (never omit the attribute). Icon-only buttons carry `aria-label` on the button, not on
the icon inside it.

## ref-language
concepts: language
The root element declares `<html lang="en">` and the document has a non-empty `<title>`. Any
passage in another language carries its own `lang` on the wrapping element.

## ref-lists
concepts: lists
Groups of related items are `<ul>`/`<ol>` with `<li>` children only — no stray `<div>` between
list and item. Definition pairs use `<dl>`/`<dt>`/`<dd>`.

## ref-status
concepts: status, labels
Validation errors and async results are announced: `role="alert"` for errors, `role="status"`
for non-urgent updates. Tie a field to its message with `aria-describedby` and `aria-invalid`.
