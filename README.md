# Carotene

Simple web tools for UM:PD (Uma Musume: Pretty Derby) players.

A public hub of small helper tools. Each tool opens in its own page and keeps its data in your browser — no accounts, no server, no tracking. Local browser storage only. Made with various AI tools.

## Tools

|Tool|Description|
|-|-|
|Carotene (hub)|Landing page with tool cards, mode/theme toggle, About|
|Track Record|Track trainee aptitudes and Completionist trophy progress. Database of 65 trainees and 152 G1–G3 races. Stable and Preview builds (kept in sync by CI).|
|'Checklist' (codename)|Daily and content checklist with reset countdowns. Required daily missions, pair-linked tasks, backup/export.|

Stable and Preview builds of Track Record are essentially the same; the preview mirrors stable, guarded by `tools/check-preview-sync.mjs` in CI.

## Stack

Static site, plain HTML/CSS and vanilla JS (ES modules). No frameworks. No build step in source (CI minifies JS with Terser and CSS with csso for deploy). Hosted on GitHub Pages.

## Storage keys

* `carotene-hub-theme` — hub theme (light/dark, Turf/Dirt), shared with Checklist; hub falls back to Track Record's saved theme
* `mylist` — Track Record's 'favorited' list
* `checklist` — Checklist tasks
* `checklist-ui` — Checklist navbar position + collapsed sections

## Icons

Trainee icons are WebP.

## CI checks

* `tools/check-imports.mjs` — verifies every ES module import resolves to a real export
* `tools/check-preview-sync.mjs` — verifies Track Record preview/ mirrors stable/

## License

Source code is licensed under GPL-3. Icons are exempt (not the author's work; fall under [Cygames' Umamusume: Pretty Derby Fan-Created Content Guidelines](https://umamusume.com/fan-createdguide)).

