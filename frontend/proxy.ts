import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["ta"];
const PASS = ["/admin", "/api", "/_next", "/sitemap.xml", "/news-sitemap.xml", "/robots.txt", "/favicon.ico", "/rss", "/health"];

// Tamil-only newspaper: every visitor gets the Tamil edition; legacy /en URLs redirect to /ta.
function preferred(_req: NextRequest): string {
  return "ta";
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PASS.some((p) => pathname === p || pathname.startsWith(p + "/")) || /\.[a-z0-9]+$/i.test(pathname)) {
    // Optimistic gate only: the real authorisation check happens in the layout/service layer.
    if (pathname.startsWith("/admin") && !req.cookies.get(process.env.SESSION_COOKIE ?? "di_session")) {
      const url = req.nextUrl.clone();
      url.pathname = "/ta/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  const first = pathname.split("/")[1];
  if (first === "en") {
    const url = req.nextUrl.clone();
    url.pathname = `/ta${pathname.slice(3)}`;
    return NextResponse.redirect(url, 308);
  }
  if (LOCALES.includes(first)) {
    const res = NextResponse.next();
    if (req.cookies.get("di_lang")?.value !== first) res.cookies.set("di_lang", first, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }
  const url = req.nextUrl.clone();
  url.pathname = `/${preferred(req)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
