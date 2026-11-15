# Apparallel

Swipe clothes onto a mannequin; the ones you keep land in one cart, sorted by store.

## Layout

- `public/index.html` — the whole site: mannequin designer, fitting room, Hot sales, Sell, cart and demo checkout.
- `public/vendor/three.min.js` — the three.js 3D library (r128, MIT licence), used for the mannequin.
- `netlify/functions/catalogue.mjs` — fetches products from Channel3 and serves them at `/api/catalogue`. Needs the Channel3 key in a Netlify environment variable named `Apparallel` (or `CHANNEL3_API_KEY`). Without it the page falls back to sample pieces.
- `netlify/functions/img.mjs` — passes product photos through the site so the page can remove their backdrops and measure them.
- `netlify.toml` — tells Netlify to publish `public/` and where functions are.

## Prototype limits

- Checkout is a demo: no payment is taken and nothing is stored or sent.
- Product photos and prices come from Channel3; listings are stand-ins until sellers list directly.
- Seller listings, cart and taste are saved in the visitor's browser only. Accounts, a database and real payments are the next build.

## Deploying

Connected to Netlify; every push to `main` goes live.
