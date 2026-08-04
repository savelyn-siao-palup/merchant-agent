# Afu · Revenue Partner Console

A single-file, zero-dependency demo console for Furday Pet Life. Everything ships in
`merchant-agent-platform-1.html`: markup, design system, dataset, and the script that
renders all 16 pages. There is no framework, no build output, and nothing to bundle.

`PRESENTATION-SCRIPT.md` is the Chinese-language demo script that goes with it.

> The page contains a real merchant's revenue figures. Keep the repository private,
> and treat the Pages URL as confidential.

## Running it locally

```sh
npm install                 # Playwright + html-validate
npm run build               # copies the HTML into dist/index.html
npm run serve               # http://127.0.0.1:4173
```

Opening the HTML file directly with `file://` works too — nothing here needs a server.
The build step exists only so the site root serves the console and so the tests and
the deploy publish byte-identical output.

## The pipeline

One workflow, `.github/workflows/ci-cd.yml`, runs on every push to `main`, every pull
request, and on demand. Three checks run in parallel; the deploy waits for all three.

| Job | What it protects |
| --- | --- |
| **HTML, links & size budget** | `html-validate` on the static shell, `lychee` on outbound links, and a hard ceiling on page weight |
| **Browser smoke tests** | Playwright loads the real page in Chromium at desktop and mobile widths |
| **Performance budget** | Lighthouse, 3 runs, desktop preset, with score and byte-weight assertions |
| **Deploy to GitHub Pages** | Runs only on `main`, only after all three pass |

Reports from the test and Lighthouse jobs upload as run artifacts (14-day retention).
Lighthouse reports are deliberately **not** sent to its public temporary storage,
which would put a copy of the page on a third-party host.

Lighthouse thresholds are 0.95 across all four categories. Current scores are
performance 1.00, accessibility 0.98, best practices 1.00, SEO 1.00, with LCP at
0.4s and 0ms total blocking time — so the gate has real margin without being
decorative. The one accessibility deduction is `heading-order`: some pages jump a
heading level. Worth fixing, not yet fixed.

### What the tests actually check

The console builds its whole UI from an inline dataset, so a renamed key or a bad
divisor produces a page that still looks fine while quietly rendering `NaN`, or an
empty chart with no error at all. Nothing in a plain static-site pipeline catches that.
`tests/smoke.spec.js` is the substitute:

- every one of the 16 pages loads from a **cold deep link** (`#value`, `#method`, …),
  each in its own browser page so the initial-route path is genuinely exercised
- every page is scanned for `NaN`, `undefined`, `[object Object]`, and `Infinity` —
  strings that only ever reach the screen when a binding broke
- no `console.error`, no uncaught exception, and no failed request, on any page
- the nav renders all 16 entries in the expected order, so adding a page to `VIEWS`
  without adding it to the test list fails the build
- the `#person/C-6284` drilldown hash and the unknown-hash fallback both resolve
- back-button navigation restores the previous page
- no page scrolls sideways, at 1280px and at 393px

### Size budget

`scripts/check-budget.mjs` fails the build above **700 KB raw / 220 KB gzipped**.
Current size is roughly 604 KB / 185 KB, so there is about 15% of headroom. Raising
the limit is fine — do it in that file, and say in the commit message why the page
needs to be bigger.

### Dependencies

`package.json` pins both devDependencies to exact versions and **no lockfile is
committed**, so CI uses `npm install` rather than `npm ci`. Exact pins give the same
reproducibility, and this avoids a lockfile that cannot be regenerated on a machine
with no node installed. Dependabot opens a monthly PR for npm and Actions bumps; CI
is what decides whether the bump is safe.

## Deploying

Merging to `main` is the deploy. Pages is configured with **Source: GitHub Actions**,
so `actions/deploy-pages` publishes `dist/` and nothing else — the markdown script and
the workflow files never reach the web.

To ship a change:

```sh
git switch -c fix/whatever
# edit merchant-agent-platform-1.html
git commit -am "…" && git push -u origin HEAD
gh pr create --fill      # CI runs on the PR
gh pr merge --squash     # merging deploys
```

Pushing straight to `main` also works and also deploys — but CI then runs *after* the
commit exists rather than before, so a broken commit is already on the branch.
