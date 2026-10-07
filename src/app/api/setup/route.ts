import { NextResponse } from "next/server";
import { createNeonClient } from "@/lib/db";
import { ensureTables } from "@/lib/ensure";
import { missingEnv } from "@/lib/config";

/**
 * Setup A (database) — verify a DATABASE_URL and create all tables.
 * The dashboard's Setup step uses this; then the user pastes the same string
 * into .env.local (local) or `vercel env add DATABASE_URL` (prod).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    databaseUrl?: string;
    action?: "verify" | "create-tables";
  };
  const url = (body.databaseUrl || process.env.DATABASE_URL || "").trim();
  if (!url) return NextResponse.json({ error: "No DATABASE_URL provided" }, { status: 400 });
  const sql = createNeonClient(url);

  try {
    if (body.action === "verify") {
      await sql`SELECT 1`;
      return NextResponse.json({ ok: true });
    }
    if (body.action === "create-tables") {
      await ensureTables(sql);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err).slice(0, 300) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ hasDatabaseUrl: !!process.env.DATABASE_URL, missing: missingEnv() });
}
