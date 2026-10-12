import { cookies } from "next/headers";
import { cookieOptions, origin, seal, unseal } from "@/lib/smartsync-server";
export async function GET(req: Request) {
  const jar = await cookies();
  try {
    const url = new URL(req.url), saved = jar.get("gradezy_ms_state")?.value;
    jar.delete("gradezy_ms_state");
    if (!saved) throw new Error("Missing sign-in state.");
    const state = unseal<{ state: string; verifier: string; expires: number }>(saved);
    if (state.expires < Date.now() || state.state !== url.searchParams.get("state") || !url.searchParams.get("code")) throw new Error("Sign-in was cancelled or expired.");
    const res = await fetch("https://login.microsoftonline.com/" + encodeURIComponent(process.env.MICROSOFT_TENANT_ID!) + "/oauth2/v2.0/token", { method: "POST", body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID!, client_secret: process.env.MICROSOFT_CLIENT_SECRET!, grant_type: "authorization_code", code: url.searchParams.get("code")!, redirect_uri: origin() + "/api/smartsync/callback", code_verifier: state.verifier }), signal: AbortSignal.timeout(30000) });
    const auth = await res.json();
    if (!res.ok || !auth.access_token) throw new Error("Microsoft rejected sign-in.");
    const seconds = Math.min(Number(auth.expires_in) || 3600, 3600);
    jar.set("gradezy_ms", seal({ access: auth.access_token, expires: Date.now() + seconds * 1000 - 60000 }), { ...cookieOptions, maxAge: seconds });
    return Response.redirect(origin() + "/sources?smartsync=connected", 303);
  } catch { jar.delete("gradezy_ms"); return Response.redirect(origin() + "/sources?smartsync=failed", 303); }
}
