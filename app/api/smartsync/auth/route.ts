import { randomBytes, createHash } from "node:crypto";
import { cookies } from "next/headers";
import { configured, cookieOptions, seal, origin, sameOrigin, failure } from "@/lib/smartsync-server";
export async function GET() {
  try {
    if (!configured()) return Response.json({ configured: false, connected: false, automated: false });
    const { token } = await import("@/lib/smartsync-server");
    let connected = false; try { await token(); connected = true; } catch {}
    return Response.json({ configured: true, connected, automated: !!(process.env.SMARTSYNC_MOODLE_URL && process.env.SMARTSYNC_MOODLE_TOKEN && process.env.SMARTSYNC_MOODLE_FUNCTION && process.env.SMARTSYNC_MOODLE_ALLOWED_USER_IDS) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return failure(e); }
}
export async function POST(req: Request) {
  try {
    if (!configured()) throw new Error("Microsoft 365 is not configured. See docs/smartsync.md.");
    sameOrigin(req);
    const state = randomBytes(32).toString("base64url"), verifier = randomBytes(32).toString("base64url");
    (await cookies()).set("gradezy_ms_state", seal({ state, verifier, expires: Date.now() + 600000 }), { ...cookieOptions, maxAge: 600 });
    const params = new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID!, response_type: "code", redirect_uri: origin() + "/api/smartsync/callback", response_mode: "query", scope: "https://graph.microsoft.com/Files.ReadWrite https://graph.microsoft.com/User.Read", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
    return Response.json({ url: "https://login.microsoftonline.com/" + encodeURIComponent(process.env.MICROSOFT_TENANT_ID!) + "/oauth2/v2.0/authorize?" + params });
  } catch (e) { return failure(e); }
}
export async function DELETE(req: Request) { try { sameOrigin(req); (await cookies()).delete("gradezy_ms"); return Response.json({ disconnected: true }); } catch (e) { return failure(e); } }
