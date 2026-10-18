import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only: bounce visitors without a session cookie to the
// right login page. The real authorisation happens server side (auth.ts /
// queries.ts) on every page and server action.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("vs_session")) {
    // Straight to the login page of the space being visited.
    const space = request.nextUrl.pathname.split("/")[1];
    const login = space === "patient" ? "/connexion/patient" : space === "praticien" || space === "coordination" ? "/connexion/praticien" : "/connexion";
    return NextResponse.redirect(new URL(login, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/praticien/:path*", "/patient/:path*", "/coordination/:path*", "/compte-rendu/:path*"],
};
