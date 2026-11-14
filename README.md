# Apparallel

Swipe clothes onto a mannequin; the ones you keep land in one cart, sorted by store.

## Layout

- `public/` — the site Netlify serves. `index.html` is the working prototype (sample catalogue, invented stores).
- `netlify/functions/catalogue.mjs` — fetches real products from Channel3 and serves them at `/api/catalogue`. Needs the `CHANNEL3_API_KEY` environment variable in Netlify. Without it the page falls back to the sample pieces.
- `netlify.toml` — tells Netlify to publish `public/` and where functions are.

## Deploying

Connect this repository in Netlify (Add new site → Import from Git). No build command is needed. Every push to `main` goes live.

## Next

1. Confirm real products load and check which stores and currencies come back.
2. Fit product photos to the mannequin properly (they are placed over it for now).
3. Add a Singapore data source; Channel3 does not list Singapore or SGD.
