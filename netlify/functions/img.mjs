// Passes product photos through the site's own address so the page is allowed
// to read their pixels (needed to remove backgrounds and measure the garment).
// Only the product-image host is accepted, so this cannot be used as an open proxy.

const ALLOWED_HOST = "cdn.trychannel3.com";

export default async (req) => {
  let target;
  try {
    target = new URL(new URL(req.url).searchParams.get("u") || "");
  } catch {
    return new Response("Bad address", { status: 400 });
  }
  if (target.protocol !== "https:" || target.hostname !== ALLOWED_HOST) {
    return new Response("Not allowed", { status: 403 });
  }
  const r = await fetch(target);
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !type.startsWith("image/")) return new Response("Not an image", { status: 502 });
  return new Response(await r.arrayBuffer(), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=604800",
      "Netlify-CDN-Cache-Control": "public, durable, s-maxage=2592000",
      "Netlify-Vary": "query=u",
    },
  });
};

export const config = { path: "/api/img" };
