import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["ta", "en"];
const PASS = ["/admin", "/api", "/_next", "/sitemap.xml", "/news-sitemap.xml", "/robots.txt", "/favicon.ico", "/rss", "/health"];

function preferred(req: NextRequest): string {
  const c = req.cookies.get("di_lang")?.value;
  if (c && LOCALES.includes(c)) return c;
  const al = req.headers.get("accept-language")?.toLowerCase() ?? "";
  const ta = al.indexOf("ta");
  const en = al.indexOf("en");
  if (en >= 0 && (ta < 0 || en < ta)) return "en";
  return "ta"; // default edition language
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PASS.some((p) => pathname === p || pathname.startsWith(p + "/")) || /\.[a-z0-9]+$/i.test(pathname)) {
    // Optimistic gate only: the real authorisation check happens in the layout/service layer.
    if (pathname.startsWith("/admin") && !req.cookies.get(process.env.SESSION_COOKIE ?? "di_session")) {
      const url = req.nextUrl.clone();
      url.pathname = "/en/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  const first = pathname.split("/")[1];
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
