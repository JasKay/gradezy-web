import { sameOrigin, token, graph, failure } from "@/lib/smartsync-server";
import type { Result } from "@/lib/smartsync";
export async function POST(req: Request) {
  try {
    sameOrigin(req); const access = await token();
    const allowed = (process.env.SMARTSYNC_MOODLE_ALLOWED_USER_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
    if (!allowed.length) throw new Error("Institutional staff authorization for Moodle retrieval is not configured.");
    const user = await graph("/me?$select=id", access);
    if (!allowed.includes(user.id)) throw new Error("Your Microsoft account is not authorized to retrieve institutional Moodle results.");
    const endpoint = process.env.SMARTSYNC_MOODLE_URL, secret = process.env.SMARTSYNC_MOODLE_TOKEN, fn = process.env.SMARTSYNC_MOODLE_FUNCTION;
    if (!endpoint || !secret || !fn) throw new Error("An authorized Moodle results service is not configured.");
    const url = new URL(endpoint); if (url.protocol !== "https:") throw new Error("Moodle requires HTTPS.");
    const input = await req.json();
    const response = await fetch(url, { method: "POST", redirect: "error", body: new URLSearchParams({ wstoken: secret, wsfunction: fn, moodlewsrestformat: "json", module: String(input.module), assessment: String(input.assessment), attempt: String(input.attempt) }), cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error("Moodle results request failed.");
    const data = await response.json();
    if (data.exception || !Array.isArray(data.results) || data.results.length > 10000) throw new Error("Moodle service must return the documented SmartSync results contract.");
    const results: Result[] = data.results.map((r: Record<string, unknown>) => {
      for (const field of ["email", "studentId", "userId", "similarity", "assessment", "attempt"]) if (typeof r[field] !== "string") throw new Error("Moodle returned an invalid results record.");
      if (r.assessment !== input.assessment || r.attempt !== input.attempt) throw new Error("Moodle returned records for a different assessment or attempt.");
      return r as Result;
    });
    return Response.json({ results });
  } catch (e) { return failure(e); }
}
