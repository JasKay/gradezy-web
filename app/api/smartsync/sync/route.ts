import { createHash } from "node:crypto";
import type { Plan } from "@/lib/smartsync";
import { token, graph, readSheet, fingerprint, unseal, sameOrigin, worksheet, failure } from "@/lib/smartsync-server";
export async function POST(req: Request) {
  let completed = 0;
  try {
    sameOrigin(req); const access = await token(), input = await req.json();
    const preview = unseal<{ base: string; sheet: string; fingerprint: string; plan: Plan; expires: number; owner: string }>(input.ticket);
    if (preview.expires < Date.now() || preview.owner !== createHash("sha256").update(access).digest("hex")) throw new Error("Preview expired. Preview again.");
    if (!preview.plan.changes.length || preview.plan.issues.length) throw new Error("Resolve all flagged records before syncing.");
    const session = await graph(preview.base + "/createSession", access, { method: "POST", body: JSON.stringify({ persistChanges: true }) });
    try {
      const current = await readSheet(preview.base, preview.sheet, access, session.id);
      if (fingerprint(current) !== preview.fingerprint) throw new Error("Workbook changed since preview. Preview again before syncing.");
      for (const change of preview.plan.changes) {
        await graph(worksheet(preview.base, preview.sheet) + "/range(address='" + change.address + "')", access, { method: "PATCH", body: JSON.stringify({ values: [[change.after]] }) }, session.id);
        completed++;
      }
    } finally { try { await graph(preview.base + "/closeSession", access, { method: "POST" }, session.id); } catch {} }
    return Response.json({ completed });
  } catch (e) {
    if (completed) return Response.json({ error: completed + " cells were updated before an error. Refresh and preview again; do not retry this preview.", completed }, { status: 409 });
    return failure(e);
  }
}
