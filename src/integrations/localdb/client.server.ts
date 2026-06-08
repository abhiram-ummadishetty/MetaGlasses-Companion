// Lightweight file-backed JSON admin client for local development (no native deps).
import fs from 'fs';
import path from 'path';

const DB_FILE = process.env.LOCAL_DB_PATH || path.join(process.cwd(), 'data', 'dev.json');

function ensureDb() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ app_users: [] }, null, 2));
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeDb(obj: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(obj, null, 2));
}

function from(table: string) {
  return {
    insert: (vals: Record<string, any>) => {
      console.log('[localdb] insert into', table, vals && { username: vals.username ? vals.username : undefined });
      const db = readDb();
      const id = vals.id ?? (globalThis.crypto && (globalThis.crypto as any).randomUUID ? (globalThis.crypto as any).randomUUID() : Date.now().toString(36));
      const row = { id, ...vals };
      if (!db[table]) db[table] = [];
      // simple uniqueness check for username
      if (table === 'app_users' && db[table].some((r: any) => r.username === row.username)) {
        const err: any = new Error('Unique constraint violation');
        (err as any).code = '23505';
        return {
          select: (_: string) => ({ single: async () => ({ data: null, error: err }) }),
        };
      }
      db[table].push(row);
      writeDb(db);
      return {
        select: (colsToSelect: string) => ({
          single: async () => {
            console.log('[localdb] select single from', table, 'id=', id);
            const selected: any = {};
            for (const c of colsToSelect.split(',').map((s) => s.trim())) selected[c] = row[c];
            return { data: selected, error: null };
          },
        }),
      };
    },
    select: (colsToSelect: string) => {
      const q: any = { cols: colsToSelect };
      q.eq = (col: string, v: string) => ({
        maybeSingle: async () => {
          console.log('[localdb] select where', table, col, '=', v);
          try {
            const db = readDb();
            const arr = db[table] || [];
            const row = arr.find((r: any) => r[col] === v) ?? null;
            if (!row) return { data: null, error: null };
            const selected: any = {};
            for (const c of colsToSelect.split(',').map((s) => s.trim())) selected[c] = row[c];
            return { data: selected, error: null };
          } catch (err: any) {
            return { data: null, error: err };
          }
        },
      });
      return q;
    },
  };
}

export const dbAdmin = { from };

// Ensure DB file exists on import
ensureDb();
