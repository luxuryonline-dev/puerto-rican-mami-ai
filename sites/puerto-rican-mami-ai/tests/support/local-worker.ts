import { DatabaseSync } from 'node:sqlite';

/** Test-only D1/R2/Email bindings. Production continues to use Cloudflare bindings. */
export const env: Record<string, any> = {};
export class WorkflowEntrypoint { env = env; }

class Prepared {
  constructor(private db: DatabaseSync, private sql: string, private parameters: any[] = []) {}
  bind(...values: any[]) { return new Prepared(this.db, this.sql, values.map(v => v === undefined ? null : v)); }
  execute() {
    const statement = this.db.prepare(this.sql);
    const results = statement.all(...this.parameters);
    const changes = this.db.prepare('SELECT changes() AS changes, last_insert_rowid() AS id').get()!;
    return { success: true, results, meta: { changes: Number(changes.changes), last_row_id: Number(changes.id), duration: 0 } };
  }
  async all() { return this.execute(); }
  async run() { return this.execute(); }
  async raw() {
    const statement = this.db.prepare(this.sql);
    statement.setReturnArrays(true);
    return statement.all(...this.parameters);
  }
  async first(column?: string) { const row = this.execute().results[0]; return row ? (column ? row[column] : row) : null; }
}

export class LocalD1 {
  readonly sqlite = new DatabaseSync(':memory:');
  prepare(sql: string) { return new Prepared(this.sqlite, sql); }
  async exec(sql: string) { this.sqlite.exec(sql); return { count: 1, duration: 0 }; }
  async batch(statements: Prepared[]) {
    this.sqlite.exec('BEGIN');
    try { const results = statements.map(statement => statement.execute()); this.sqlite.exec('COMMIT'); return results; }
    catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}

export class LocalR2 {
  readonly objects = new Map<string, { bytes: ArrayBuffer; httpMetadata: any; customMetadata: any }>();
  async put(key: string, value: any, options: any = {}) {
    const bytes = await new Response(value).arrayBuffer();
    this.objects.set(key, { bytes, httpMetadata: options.httpMetadata ?? {}, customMetadata: options.customMetadata ?? {} });
    return this.head(key);
  }
  async head(key: string) {
    const object = this.objects.get(key); if (!object) return null;
    return { key, size: object.bytes.byteLength, httpMetadata: object.httpMetadata, customMetadata: object.customMetadata,
      httpEtag: '"local-test-etag"', writeHttpMetadata(headers: Headers) { if (object.httpMetadata.contentType) headers.set('content-type', object.httpMetadata.contentType); } };
  }
  async get(key: string) {
    const object = this.objects.get(key); if (!object) return null;
    return { ...await this.head(key), body: new Response(object.bytes.slice(0)).body,
      arrayBuffer: async () => object.bytes.slice(0) };
  }
  async delete(key: string) { this.objects.delete(key); }
}
