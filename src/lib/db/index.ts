import { neon } from "@neondatabase/serverless";

export type Row = Record<string, unknown>;

export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Row[]>;

/** Create a Neon HTTP client typed for our use (template-string raw SQL). */
export function createNeonClient(url: string): SqlClient {
  const sql = neon(url.trim());
  return ((strings: TemplateStringsArray, ...values: unknown[]) =>
    sql(strings, ...values)) as unknown as SqlClient;
}

export function getDb(): SqlClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("No DATABASE_URL");
  return createNeonClient(url);
}
