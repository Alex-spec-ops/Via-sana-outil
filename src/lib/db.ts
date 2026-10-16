import "server-only";
import path from "node:path";
import { SCHEMA, TABLES_CHILD_FIRST } from "./schema";
import { seed } from "./seed";

// PostgreSQL, two engines behind one small interface:
// - DATABASE_URL set  → a Supabase (or any PostgreSQL) database, reached from the
//   server only, over TLS. Use an EU region: health data must be stored in the
//   EU/EEA (CSP R1111-9-1). Supabase is NOT an HDS-certified host: this mode is
//   for fictional demo data only (CSP L1111-8, R1111-8-8). See docs/.
// - otherwise          → PGlite, an embedded PostgreSQL (local demo, offline
//   plan B). On Vercel without DATABASE_URL it runs in memory and is re-seeded
//   on each cold start.

// Bump when the schema or the demo data format changes: an older demo database is rebuilt from scratch.
const SCHEMA_VERSION = "5";

type Value = string | number | null | undefined;
/** Positional values ("?" placeholders), or one object of named values (":name" placeholders). */
export type Params = Value[] | [Record<string, Value>];

export interface Db {
  all<T>(sql: string, ...params: Params): Promise<T[]>;
  get<T>(sql: string, ...params: Params): Promise<T | undefined>;
  run(sql: string, ...params: Params): Promise<void>;
}

type Engine = Db & {
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  name: "supabase" | "pglite";
};

/** Rewrites "?" or ":name" placeholders into PostgreSQL's $1, $2… */
function toPg(sql: string, params: Params): [string, Value[]] {
  const first = params[0];
  if (params.length === 1 && first !== null && typeof first === "object") {
    const named = first as Record<string, Value>;
    const values: Value[] = [];
    const index: Record<string, number> = {};
    const text = sql.replace(/(?<![:\w]):([a-zA-Z_]\w*)/g, (_, name: string) => {
      if (!(name in index)) {
        values.push(named[name] ?? null);
        index[name] = values.length;
      }
      return `$${index[name]}`;
    });
    return [text, values];
  }
  let i = 0;
  return [sql.replace(/\?/g, () => `$${++i}`), (params as Value[]).map((v) => v ?? null)];
}

/** Builds the all/get/run trio on top of a raw "query → rows" function. */
function wrap(query: (sql: string, values: Value[]) => Promise<Record<string, unknown>[]>): Db {
  return {
    async all<T>(sql: string, ...params: Params) {
      const [text, values] = toPg(sql, params);
      return (await query(text, values)) as T[];
    },
    async get<T>(sql: string, ...params: Params) {
      const [text, values] = toPg(sql, params);
      return (await query(text, values))[0] as T | undefined;
    },
    async run(sql: string, ...params: Params) {
      const [text, values] = toPg(sql, params);
      await query(text, values);
    },
  };
}

async function openSupabase(url: string): Promise<Engine> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    ssl: "require",
    prepare: false, // compatible with Supabase's transaction pooler (port 6543)
    max: 3,
    idle_timeout: 20,
    onnotice: () => {}, // e.g. "table does not exist, skipping" while (re)building the demo schema
    types: { bigint: { to: 20, from: [20], parse: (v: string) => Number(v), serialize: (v: number) => String(v) } },
  });
  const unsafe = (s: typeof sql) => async (text: string, values: Value[]) =>
    (await s.unsafe(text, values as never[])) as unknown as Record<string, unknown>[];
  return {
    name: "supabase",
    ...wrap(unsafe(sql)),
    async exec(text) {
      await sql.unsafe(text);
    },
    async transaction(fn) {
      return (await sql.begin((tx) => fn(wrap(unsafe(tx as unknown as typeof sql))))) as never;
    },
  };
}

async function openPglite(): Promise<Engine> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.VERCEL ? "memory://" : path.join(process.cwd(), "data", "pglite");
  // COUNT(*) is a bigint (oid 20): read it as a plain number.
  const pg = await PGlite.create(dataDir, { parsers: { 20: (v: string) => Number(v) } });
  const query = (q: Pick<typeof pg, "query">) => async (text: string, values: Value[]) =>
    (await q.query<Record<string, unknown>>(text, values)).rows;
  return {
    name: "pglite",
    ...wrap(query(pg)),
    async exec(text) {
      await pg.exec(text);
    },
    async transaction(fn) {
      return pg.transaction((tx) => fn(wrap(query(tx))));
    },
  };
}

async function open(): Promise<Engine> {
  const url = process.env.DATABASE_URL;
  const engine = url ? await openSupabase(url) : await openPglite();
  await engine.exec("CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const version = await engine.get<{ value: string }>("SELECT value FROM app_meta WHERE key = 'schema_version'");
  if (version?.value !== SCHEMA_VERSION) {
    // Demo database only: an outdated schema is dropped and rebuilt.
    for (const table of TABLES_CHILD_FIRST) await engine.exec(`DROP TABLE IF EXISTS ${table} CASCADE`);
    await engine.exec(SCHEMA);
    await engine.run(
      "INSERT INTO app_meta (key, value) VALUES ('schema_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
      SCHEMA_VERSION,
    );
  }
  const count = await engine.get<{ n: number }>("SELECT COUNT(*) AS n FROM coordinators");
  if (!count?.n) await engine.transaction((tx) => seed(tx));
  return engine;
}

const globalForDb = globalThis as unknown as { viaSanaDb?: Promise<Engine>; viaSanaDbVersion?: string };
function engine() {
  if (!globalForDb.viaSanaDb || globalForDb.viaSanaDbVersion !== SCHEMA_VERSION) {
    globalForDb.viaSanaDb = open().catch((err) => {
      globalForDb.viaSanaDb = undefined; // retry on the next request
      throw err;
    });
    globalForDb.viaSanaDbVersion = SCHEMA_VERSION;
  }
  return globalForDb.viaSanaDb;
}

export async function all<T>(sql: string, ...params: Params) {
  return (await engine()).all<T>(sql, ...params);
}

export async function get<T>(sql: string, ...params: Params) {
  return (await engine()).get<T>(sql, ...params);
}

export async function run(sql: string, ...params: Params) {
  return (await engine()).run(sql, ...params);
}

/** Runs `fn` atomically. Inside it, always use the `tx` it receives, never the global helpers. */
export async function transaction<T>(fn: (tx: Db) => Promise<T>) {
  return (await engine()).transaction(fn);
}

export async function databaseEngine() {
  return (await engine()).name;
}

/** Wipes every table and re-seeds the fictional demo data. */
export async function resetDemoData() {
  await transaction(async (tx) => {
    for (const table of TABLES_CHILD_FIRST) await tx.run(`DELETE FROM ${table}`);
    await seed(tx);
  });
}
