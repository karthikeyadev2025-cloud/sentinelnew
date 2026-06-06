import { NextResponse } from "next/server";

// Server-side proxy for opencv.js to bypass browser CORS restrictions.
// The browser fetches from /api/opencv (same origin), the server fetches
// the actual file from a CDN \u2014 no CORS header needed on the client.
export const dynamic = "force-dynamic";
export const revalidate = 604800; // Cache for 7 days

const OPENCV_CDN_URLS = [
  "https://cdn.jsdelivr.net/npm/mirada@0.0.15/dist/src/opencv.js",
  "https://docs.opencv.org/4.5.4/opencv.js",
];

export async function GET() {
  let lastError: Error | null = null;

  for (const url of OPENCV_CDN_URLS) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 604800 },
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SentinelCinemaDRM/1.0)",
        },
      });

      if (!res.ok) {
        lastError = new Error(`CDN ${url} returned ${res.status}`);
        continue;
      }

      const content = await res.text();

      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=604800, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  // All CDNs failed \u2014 return a minimal stub so the admin page doesn\u2019t crash
  console.error("OpenCV proxy: all CDN mirrors failed.", lastError);
  return new NextResponse(
    `// OpenCV.js proxy: all CDN mirrors unreachable. Fallback canvas pipeline will be used.\nwindow.cv = null;`,
    {
      status: 200,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    }
  );
}
