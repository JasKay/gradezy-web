import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Sheet } from "./smartsync";
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/api/smartsync" };
export function configured() { return !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET && process.env.MICROSOFT_TENANT_ID && process.env.SMARTSYNC_SECRET && process.env.SMARTSYNC_ORIGIN); }
function key() { const secret = process.env.SMARTSYNC_SECRET; if (!secret || secret.length < 32) throw new Error("SMARTSYNC_SECRET must contain at least 32 characters."); return createHash("sha256").update(secret).digest(); }
export function seal(value: unknown) { const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv); const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url"); }
export function unseal<T>(value: string): T { const b = Buffer.from(value, "base64url"), d = createDecipheriv("aes-256-gcm", key(), b.subarray(0,12)); d.setAuthTag(b.subarray(12,28)); return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString()); }
export function origin() { const url = new URL(process.env.SMARTSYNC_ORIGIN!); return url.origin; }
export function sameOrigin(req: Request) { if (req.headers.get("origin") !== origin()) throw new Error("Request origin rejected."); }
export async function token() {
  const jar = await cookies(), value = jar.get("gradezy_ms")?.value;
  if (!value) throw new Error("Connect Microsoft 365 first.");
  const auth = unseal<{ access: string; expires: number }>(value);
  if (auth.expires < Date.now()) throw new Error("Microsoft sign-in expired. Reconnect to continue.");
  return auth.access;
}
export async function graph(path: string, access: string, init: RequestInit = {}, session?: string) {
  const res = await fetch("https://graph.microsoft.com/v1.0" + path, { ...init, cache: "no-store", headers: { Authorization: "Bearer " + access, "Content-Type": "application/json", ...(session ? { "workbook-session-id": session } : {}), ...init.headers }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error("Microsoft Graph request failed (" + res.status + "). Check workbook permissions, locks and your connection.");
  return res.status === 204 ? {} : res.json();
}
export async function resolveWorkbook(link: string, access: string) {
  const url = new URL(link);
  if (url.protocol !== "https:" || !(url.hostname.endsWith(".sharepoint.com") || url.hostname === "1drv.ms" || url.hostname === "onedrive.live.com")) throw new Error("Use an HTTPS SharePoint or OneDrive workbook sharing link.");
  const item = await graph("/shares/u!" + Buffer.from(link).toString("base64url") + "/driveItem", access);
  if (!item.file || !/\.xlsx$/i.test(item.name) || !item.parentReference?.driveId) throw new Error("Select an .xlsx workbook on SharePoint or OneDrive for Business.");
  return { base: "/drives/" + encodeURIComponent(item.parentReference.driveId) + "/items/" + encodeURIComponent(item.id) + "/workbook", name: item.name };
}
export function worksheet(base: string, id: string) { return base + "/worksheets/" + encodeURIComponent(id); }
export async function readSheet(base: string, id: string, access: string, session?: string): Promise<Sheet> {
  const range = await graph(worksheet(base,id) + "/usedRange(valuesOnly=true)", access, {}, session);
  if (range.rowCount > 10000 || range.columnCount > 200) throw new Error("SmartSync supports up to 10,000 used rows and 200 columns.");
  return { values: range.values, formulas: range.formulas, rowIndex: range.rowIndex, columnIndex: range.columnIndex };
}
export function fingerprint(sheet: Sheet) { return createHash("sha256").update(JSON.stringify(sheet)).digest("hex"); }
export function failure(e: unknown) { return Response.json({ error: e instanceof Error ? e.message : "SmartSync request failed." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
