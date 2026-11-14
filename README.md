# Apparallel

Swipe clothes onto a mannequin; the ones you keep land in one cart, sorted by store.

## Layout

- `public/` — the site Netlify serves. `index.html` is the working prototype (sample catalogue, invented stores).
- `netlify/functions/` — backend functions. Empty for now; the product-data fetch will live here so API keys stay off the page.
- `netlify.toml` — tells Netlify to publish `public/` and where functions are.

## Deploying

Connect this repository in Netlify (Add new site → Import from Git). No build command is needed. Every push to `main` goes live.

## Next

1. Pick a product data source and add its key as a Netlify environment variable.
2. Add a `catalogue` function that returns real products in the shape the page expects.
3. Replace the drawn garments with cut-out product photos fitted to the mannequin.
