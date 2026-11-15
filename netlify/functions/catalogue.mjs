// Returns real products for the fitting room, in the shape the page expects.
// Data source: Channel3 product search. The key lives in the CHANNEL3_API_KEY
// environment variable and never reaches the browser.

const API = "https://api.trychannel3.com/v1/search";

const SEARCHES = [
  { cat: "top", query: "t-shirts and shirts" },
  { cat: "top", query: "hoodies and sweaters" },
  { cat: "bottom", query: "jeans and trousers" },
  { cat: "dress", query: "dresses", skipFor: "male" },
  { cat: "outer", query: "jackets" },
  { cat: "shoes", query: "sneakers" },
];

const STYLE_WORDS = {
  street: "streetwear",
  minimal: "minimalist",
  vintage: "vintage style",
  sporty: "athleisure",
  smart: "smart casual",
  y2k: "y2k",
};

// Names the main colour of a piece so the feed can learn colour taste.
function hueName(colors) {
  const c = (colors || []).slice().sort((a, b) => (b.percentage || 0) - (a.percentage || 0))[0];
  if (!c || !/^#?[0-9a-f]{6}$/i.test(c.hex || "")) return "";
  const n = parseInt(c.hex.replace("#", ""), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (l < 0.16) return "black";
  if (l > 0.86 && s < 0.25) return "white";
  if (s < 0.14) return "grey";
  let hdeg = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hdeg = (hdeg * 60 + 360) % 360;
  if (hdeg < 15 || hdeg >= 345) return "red";
  if (hdeg < 45) return l < 0.45 ? "brown" : "orange";
  if (hdeg < 68) return s < 0.45 ? "beige" : "yellow";
  if (hdeg < 170) return "green";
  if (hdeg < 260) return "blue";
  if (hdeg < 300) return "purple";
  return "pink";
}

// Only photos of the product on its own can be put on the mannequin. Photos of a person wearing
// the piece are left out, and so are products that have no other kind of photo.
const PRODUCT_SHOTS = { shoes: ["hero", "angle_view", "flat_lay"], other: ["flat_lay", "hero"] };

function pickImage(images, cat) {
  const allowed = PRODUCT_SHOTS[cat] || PRODUCT_SHOTS.other;
  let best = null;
  let bestScore = -Infinity;
  for (const im of images || []) {
    if (!im || !im.url || !allowed.includes(im.shot_type)) continue;
    let s = allowed.length - allowed.indexOf(im.shot_type);
    if (im.cleaned_url) s += 10;
    if (im.is_main_image) s += 1;
    if (s > bestScore) { bestScore = s; best = im; }
  }
  return best;
}

function sizesOf(p) {
  const opts = (p.variants && p.variants.options) || [];
  const size = opts.find((o) => /size/i.test(o.name || ""));
  if (!size) return [];
  return (size.values || []).filter((v) => v.exists !== false).map((v) => String(v.label)).slice(0, 14);
}

const KID_SIZE = /^\d+(\s*-\s*\d+)?\s*(y\+?|yrs?|years?|months?|mos?|t)$/i;

function normalise(p, cat, style) {
  if (p.age && p.age !== "adult") return null;
  if (sizesOf(p).some((s) => KID_SIZE.test(s.trim()))) return null;
  const offer = (p.offers || []).find((o) => o.availability === "InStock" && o.price) || (p.offers || [])[0];
  const im = pickImage(p.images, cat);
  if (!offer || !offer.price || !im) return null;
  return {
    id: "c3-" + p.id,
    live: true,
    name: p.title,
    brand: (p.brands && p.brands[0] && p.brands[0].name) || "",
    store: offer.domain,
    url: offer.url,
    price: offer.price.price,
    was: offer.price.compare_at_price && offer.price.compare_at_price > offer.price.price ? offer.price.compare_at_price : null,
    cur: offer.price.currency,
    cat,
    g: p.gender === "female" ? "w" : p.gender === "male" ? "m" : "u",
    img: im.cleaned_url || im.url,
    cut: Boolean(im.cleaned_url),
    shot: im.shot_type || "",
    style: style || "",
    hue: hueName(p.colors),
    sizes: sizesOf(p),
  };
}

async function search(key, s, gender, maxPrice, limit, style, sale) {
  const who = gender === "female" ? "women's " : gender === "male" ? "men's " : "";
  const look = style ? STYLE_WORDS[style] + " " : "";
  const body = { query: who + look + s.query, limit };
  const filters = {};
  if (gender) filters.gender = gender;
  if (maxPrice) filters.price = { max_price: maxPrice };
  if (sale) filters.sale = "on_sale";
  if (Object.keys(filters).length) body.filters = filters;
  const r = await fetch(API, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).slice(0, 200);
    throw new Error("Channel3 answered " + r.status + " " + detail);
  }
  const data = await r.json();
  return (data.products || []).map((p) => normalise(p, s.cat, style)).filter(Boolean);
}

function json(status, payload, cache) {
  const headers = { "Content-Type": "application/json" };
  if (cache) {
    // One fetch per shopper type per day keeps usage inside the free tier.
    headers["Cache-Control"] = "public, max-age=0, must-revalidate";
    headers["Netlify-CDN-Cache-Control"] = "public, durable, s-maxage=86400";
    headers["Netlify-Vary"] = "query=who|max|cats|style|sale";
  } else {
    headers["Cache-Control"] = "no-store";
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

export default async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    return json(200, { items: [], error: "Function crashed: " + String(e && e.message) });
  }
};

async function handle(req) {
  // The key is stored in Netlify as "Apparallel"; CHANNEL3_API_KEY also works.
  const env = (name) => (globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(name)) || process.env[name];
  const key = (env("CHANNEL3_API_KEY") || env("Apparallel") || "").trim();
  if (!key) {
    // Names only, never values: helps spot a misspelt variable.
    const similar = Object.keys(process.env).filter((k) => /channel|api_?key/i.test(k));
    return json(200, { items: [], error: "No Channel3 key found in Netlify (looked for CHANNEL3_API_KEY and Apparallel).", similar_names: similar });
  }

  const params = new URL(req.url).searchParams;
  const who = params.get("who");
  const gender = who === "w" ? "female" : who === "m" ? "male" : null;
  const maxPrice = [50, 100, 200].includes(Number(params.get("max"))) ? Number(params.get("max")) : 0;
  const style = STYLE_WORDS[params.get("style")] ? params.get("style") : "";
  const sale = params.get("sale") === "1";
  const wanted = (params.get("cats") || "").split(",").filter(Boolean);
  let jobs = SEARCHES.filter((s) => s.skipFor !== gender);
  if (wanted.length) jobs = jobs.filter((s) => wanted.includes(s.cat));
  if (!jobs.length) return json(200, { items: [] });
  // Fewer kinds of clothing asked for means more of each.
  const limit = 30; // many products are dropped for lacking a product-only photo, so ask for the most allowed

  const results = await Promise.allSettled(jobs.map((s) => search(key, s, gender, maxPrice, limit, style, sale)));
  const lists = results.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!lists.length) {
    const why = results[0] && results[0].reason ? String(results[0].reason.message) : "unknown error";
    return json(200, { items: [], error: "Could not load products: " + why });
  }

  // Deal the lists out in turn so categories mix on the rail.
  const seen = new Set();
  const items = [];
  for (let i = 0; i < limit; i++) {
    for (const list of lists) {
      const it = list[i];
      if (it && !seen.has(it.id)) { seen.add(it.id); items.push(it); }
    }
  }
  return json(200, { items }, true);
}

export const config = { path: "/api/catalogue" };
