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

const GOOD_SHOTS = ["flat_lay", "hero", "angle_view"];
const BAD_SHOTS = ["on_model", "lifestyle", "in_use", "size_chart", "packaging", "product_information", "merchant_information"];

function pickImage(images) {
  let best = null;
  let bestScore = -Infinity;
  for (const im of images || []) {
    if (!im || !im.url) continue;
    let s = 0;
    if (im.cleaned_url) s += 10;
    if (GOOD_SHOTS.includes(im.shot_type)) s += 4;
    if (BAD_SHOTS.includes(im.shot_type)) s -= 6;
    if (im.is_main_image) s += 2;
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

function normalise(p, cat) {
  if (p.age && p.age !== "adult") return null;
  if (sizesOf(p).some((s) => KID_SIZE.test(s.trim()))) return null;
  const offer = (p.offers || []).find((o) => o.availability === "InStock" && o.price) || (p.offers || [])[0];
  const im = pickImage(p.images);
  if (!offer || !offer.price || !im) return null;
  return {
    id: "c3-" + p.id,
    live: true,
    name: p.title,
    brand: (p.brands && p.brands[0] && p.brands[0].name) || "",
    store: offer.domain,
    url: offer.url,
    price: offer.price.price,
    cur: offer.price.currency,
    cat,
    g: p.gender === "female" ? "w" : p.gender === "male" ? "m" : "u",
    img: im.cleaned_url || im.url,
    cut: Boolean(im.cleaned_url),
    sizes: sizesOf(p),
  };
}

async function search(key, s, gender, maxPrice, limit) {
  const who = gender === "female" ? "women's " : gender === "male" ? "men's " : "";
  const body = { query: who + s.query, limit };
  const filters = {};
  if (gender) filters.gender = gender;
  if (maxPrice) filters.price = { max_price: maxPrice };
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
  return (data.products || []).map((p) => normalise(p, s.cat)).filter(Boolean);
}

function json(status, payload, cache) {
  const headers = { "Content-Type": "application/json" };
  if (cache) {
    // One fetch per shopper type per day keeps usage inside the free tier.
    headers["Cache-Control"] = "public, max-age=0, must-revalidate";
    headers["Netlify-CDN-Cache-Control"] = "public, durable, s-maxage=86400";
    headers["Netlify-Vary"] = "query=who|max|cats";
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
  const wanted = (params.get("cats") || "").split(",").filter(Boolean);
  let jobs = SEARCHES.filter((s) => s.skipFor !== gender);
  if (wanted.length) jobs = jobs.filter((s) => wanted.includes(s.cat));
  if (!jobs.length) return json(200, { items: [] });
  // Fewer kinds of clothing asked for means more of each.
  const limit = Math.max(12, Math.min(30, Math.floor(72 / jobs.length)));

  const results = await Promise.allSettled(jobs.map((s) => search(key, s, gender, maxPrice, limit)));
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
