import { planChanges, type Result } from "@/lib/smartsync";
import { token, resolveWorkbook, readSheet, fingerprint, seal, sameOrigin, failure } from "@/lib/smartsync-server";
export async function POST(req: Request) {
  try {
    sameOrigin(req); const access = await token(), input = await req.json();
    if (!Array.isArray(input.results) || input.results.length > 10000) throw new Error("Provide up to 10,000 source records.");
    const book = await resolveWorkbook(input.link, access), sheet = await readSheet(book.base, input.sheet, access);
    const plan = planChanges(sheet, input.results as Result[], input.mapping, input.assessment, input.attempt);
    if (plan.changes.length > 1000) throw new Error("Preview exceeds 1,000 cell updates. Split the assessment into smaller batches.");
    const ticket = seal({ base: book.base, sheet: input.sheet, fingerprint: fingerprint(sheet), plan, expires: Date.now() + 600000, owner: await import("node:crypto").then(c => c.createHash("sha256").update(access).digest("hex")) });
    return Response.json({ ...plan, ticket });
  } catch (e) { return failure(e); }
}
