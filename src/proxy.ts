import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: bounce visitors without a session cookie to the
// profile picker. The real authorisation happens server side (auth.ts /
// queries.ts) on every page and server action.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("vs_session")) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/praticien/:path*", "/patient/:path*", "/coordination/:path*", "/compte-rendu/:path*"],
};
