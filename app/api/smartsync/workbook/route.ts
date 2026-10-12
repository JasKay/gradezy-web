import { token, resolveWorkbook, graph, readSheet, sameOrigin, failure } from "@/lib/smartsync-server";
export async function POST(req: Request) {
  try {
    sameOrigin(req); const access = await token(), input = await req.json();
    const book = await resolveWorkbook(input.link, access);
    const sheets = await graph(book.base + "/worksheets", access);
    return Response.json({ name: book.name, sheets: sheets.value.map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })), ...(input.sheet ? { sheet: await readSheet(book.base, input.sheet, access) } : {}) });
  } catch (e) { return failure(e); }
}
