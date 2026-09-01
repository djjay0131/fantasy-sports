# docs/print/

Printable cheat sheets, rendered by `scripts/pdf.mjs` from the **private**
board. Everything here except this file is git-ignored: the sheets are derived
from a paid subscriber source and are for personal use only (ADR-0001).

They live under `docs/` so the local board server can serve them — open
`/print/guillotine-cheatsheet.pdf` from any device on your tailnet. On the
published site the directory contains only this README.

```bash
node scripts/refresh.mjs && node scripts/guillotine.mjs --teams 18
node scripts/pdf.mjs
```
