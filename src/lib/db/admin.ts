import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { query } from '@/lib/db/pool';

type Result = { data: any; error: any; count?: number | null };
type Operation = 'select' | 'insert' | 'update' | 'upsert' | 'delete';
type Filter = { column: string; operator: string; value: unknown };
type Row = any;

interface AdminResult<T> { data: T; error: any; count?: number | null }
interface AdminQuery<T = Row[]> extends PromiseLike<AdminResult<T>> {
  select(selection?: string): AdminQuery<Row[]>;
  insert(value: Row | Row[]): AdminQuery<Row[]>;
  update(value: Row): AdminQuery<Row[]>;
  upsert(value: Row | Row[], options?: { onConflict?: string }): AdminQuery<Row[]>;
  delete(): AdminQuery<Row[]>;
  eq(column: string, value: unknown): AdminQuery<T>;
  neq(column: string, value: unknown): AdminQuery<T>;
  gt(column: string, value: unknown): AdminQuery<T>;
  gte(column: string, value: unknown): AdminQuery<T>;
  lt(column: string, value: unknown): AdminQuery<T>;
  lte(column: string, value: unknown): AdminQuery<T>;
  like(column: string, value: unknown): AdminQuery<T>;
  ilike(column: string, value: unknown): AdminQuery<T>;
  is(column: string, value: unknown): AdminQuery<T>;
  in(column: string, value: unknown[]): AdminQuery<T>;
  or(expression: string): AdminQuery<T>;
  order(column: string, options?: { ascending?: boolean }): AdminQuery<T>;
  limit(value: number): AdminQuery<T>;
  range(from: number, to: number): AdminQuery<T>;
  single(): AdminQuery<Row>;
  maybeSingle(): AdminQuery<Row | null>;
}
interface AdminContract {
  from(table: string): AdminQuery;
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<AdminResult<any>>;
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;
const DEFAULT_CONFLICT_COLUMNS: Record<string, string[]> = {
  system_settings: ['key'],
  user_beyblade_points: ['user_id', 'beyblade_id'],
  player_win_rate_totals: ['period_month', 'player_id'],
};
const JSON_COLUMNS: Record<string, Set<string>> = {
  registrations: new Set(['main_deck', 'reserve_decks']),
  system_settings: new Set(['value']),
  tournaments: new Set(['ranking_badges_snapshot', 'settings']),
};

function postgresValue(table: string, column: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  return JSON_COLUMNS[table]?.has(column) ? JSON.stringify(value) : value;
}

function identifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return `"${value}"`;
}

function columns(selection?: string): string {
  if (!selection || selection.trim() === '*') return '*';
  return selection.split(',').map((part) => identifier(part.trim())).join(', ');
}

function errorResult(error: unknown): Result {
  const candidate = error as { message?: string; code?: string; detail?: string };
  return {
    data: null,
    error: {
      message: candidate?.message || String(error),
      code: candidate?.code,
      details: candidate?.detail,
    },
  };
}

class PostgresQueryBuilder implements PromiseLike<Result> {
  private operation: Operation = 'select';
  private selection = '*';
  private payload: Record<string, unknown>[] = [];
  private filters: Filter[] = [];
  private orFilters: Filter[] = [];
  private ordering: { column: string; ascending: boolean }[] = [];
  private rowLimit?: number;
  private rowOffset?: number;
  private cardinality: 'many' | 'single' | 'maybeSingle' = 'many';
  private conflictColumns?: string[];

  constructor(private readonly table: string) {
    identifier(table);
  }

  select(selection = '*'): this { this.selection = selection; return this; }
  insert(value: Record<string, unknown> | Record<string, unknown>[]): this {
    this.operation = 'insert'; this.payload = Array.isArray(value) ? value : [value]; return this;
  }
  update(value: Record<string, unknown>): this {
    this.operation = 'update'; this.payload = [value]; return this;
  }
  upsert(value: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }): this {
    this.operation = 'upsert'; this.payload = Array.isArray(value) ? value : [value];
    this.conflictColumns = options?.onConflict?.split(',').map((item) => item.trim());
    return this;
  }
  delete(): this { this.operation = 'delete'; return this; }
  eq(column: string, value: unknown): this { this.filters.push({ column, operator: '=', value }); return this; }
  neq(column: string, value: unknown): this { this.filters.push({ column, operator: '<>', value }); return this; }
  gt(column: string, value: unknown): this { this.filters.push({ column, operator: '>', value }); return this; }
  gte(column: string, value: unknown): this { this.filters.push({ column, operator: '>=', value }); return this; }
  lt(column: string, value: unknown): this { this.filters.push({ column, operator: '<', value }); return this; }
  lte(column: string, value: unknown): this { this.filters.push({ column, operator: '<=', value }); return this; }
  like(column: string, value: unknown): this { this.filters.push({ column, operator: 'LIKE', value }); return this; }
  ilike(column: string, value: unknown): this { this.filters.push({ column, operator: 'ILIKE', value }); return this; }
  is(column: string, value: unknown): this { this.filters.push({ column, operator: 'IS', value }); return this; }
  in(column: string, value: unknown[]): this { this.filters.push({ column, operator: 'IN', value }); return this; }
  or(expression: string): this {
    this.orFilters.push(...expression.split(',').map((part) => {
      const match = part.match(/^([a-z_][a-z0-9_]*)\.(eq|ilike|like)\.(.*)$/i);
      if (!match) throw new Error(`Unsupported OR filter: ${part}`);
      const raw = match[3].replace(/^"|"$/g, '');
      return { column: match[1], operator: match[2].toLowerCase() === 'eq' ? '=' : match[2].toUpperCase(), value: raw };
    }));
    return this;
  }
  order(column: string, options?: { ascending?: boolean }): this {
    this.ordering.push({ column, ascending: options?.ascending !== false }); return this;
  }
  limit(value: number): this { this.rowLimit = value; return this; }
  range(from: number, to: number): this { this.rowOffset = from; this.rowLimit = to - from + 1; return this; }
  single(): this { this.cardinality = 'single'; this.rowLimit = 2; return this; }
  maybeSingle(): this { this.cardinality = 'maybeSingle'; this.rowLimit = 2; return this; }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private where(values: unknown[]): string {
    const clause = (filter: Filter) => {
      const column = identifier(filter.column);
      if (filter.operator === 'IS') {
        if (filter.value === null) return `${column} IS NULL`;
        if (filter.value === true || filter.value === false) return `${column} IS ${filter.value ? 'TRUE' : 'FALSE'}`;
        throw new Error('IS supports only null or boolean values');
      }
      if (filter.operator === 'IN') {
        const items = filter.value as unknown[];
        if (!items.length) return 'FALSE';
        const placeholders = items.map((item) => { values.push(item); return `$${values.length}`; });
        return `${column} IN (${placeholders.join(', ')})`;
      }
      values.push(filter.value);
      return `${column} ${filter.operator} $${values.length}`;
    };
    const and = this.filters.map(clause);
    if (this.orFilters.length) and.push(`(${this.orFilters.map(clause).join(' OR ')})`);
    return and.length ? ` WHERE ${and.join(' AND ')}` : '';
  }

  private returning(): string { return this.selection ? ` RETURNING ${columns(this.selection)}` : ''; }

  private build(): { text: string; values: unknown[] } {
    const values: unknown[] = [];
    const table = identifier(this.table);
    let text: string;

    if (this.operation === 'select') {
      text = `SELECT ${columns(this.selection)} FROM public.${table}${this.where(values)}`;
      if (this.ordering.length) {
        text += ` ORDER BY ${this.ordering.map(({ column, ascending }) => `${identifier(column)} ${ascending ? 'ASC' : 'DESC'}`).join(', ')}`;
      }
      if (this.rowLimit !== undefined) { values.push(this.rowLimit); text += ` LIMIT $${values.length}`; }
      if (this.rowOffset !== undefined) { values.push(this.rowOffset); text += ` OFFSET $${values.length}`; }
      return { text, values };
    }

    if (this.operation === 'delete') {
      return { text: `DELETE FROM public.${table}${this.where(values)}${this.returning()}`, values };
    }

    const rows = this.payload.map((row) => Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined)));
    if (!rows.length) throw new Error(`${this.operation} requires at least one row`);

    if (this.operation === 'update') {
      const entries = Object.entries(rows[0]);
      if (!entries.length) throw new Error('update requires at least one defined column');
      const set = entries.map(([key, value]) => {
        values.push(postgresValue(this.table, key, value));
        return `${identifier(key)} = $${values.length}`;
      });
      text = `UPDATE public.${table} SET ${set.join(', ')}${this.where(values)}${this.returning()}`;
      return { text, values };
    }

    const insertColumns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const tuples = rows.map((row) => `(${insertColumns.map((key) => {
      values.push(postgresValue(this.table, key, row[key]));
      return `$${values.length}`;
    }).join(', ')})`);
    text = `INSERT INTO public.${table} (${insertColumns.map(identifier).join(', ')}) VALUES ${tuples.join(', ')}`;

    if (this.operation === 'upsert') {
      const conflict = this.conflictColumns || DEFAULT_CONFLICT_COLUMNS[this.table] || ['id'];
      const updates = insertColumns.filter((key) => !conflict.includes(key));
      text += ` ON CONFLICT (${conflict.map(identifier).join(', ')}) `;
      text += updates.length
        ? `DO UPDATE SET ${updates.map((key) => `${identifier(key)} = EXCLUDED.${identifier(key)}`).join(', ')}`
        : 'DO NOTHING';
    }
    text += this.returning();
    return { text, values };
  }

  private async execute(): Promise<Result> {
    try {
      const built = this.build();
      const result = await query(built.text, built.values);
      const rows = result.rows;
      if (this.cardinality !== 'many') {
        if (rows.length > 1) return { data: null, error: { message: 'JSON object requested, multiple rows returned', code: 'PGRST116' } };
        if (!rows.length && this.cardinality === 'single') return { data: null, error: { message: 'JSON object requested, no rows returned', code: 'PGRST116' } };
        return { data: rows[0] || null, error: null };
      }
      return { data: this.operation === 'select' || this.selection ? rows : null, error: null, count: result.rowCount };
    } catch (error) {
      return errorResult(error);
    }
  }
}

function createPostgresAdmin() {
  return {
    from(table: string) { return new PostgresQueryBuilder(table); },
    async rpc(name: string, args: Record<string, unknown> = {}): Promise<Result> {
      try {
        identifier(name);
        if (name === 'exec_sql') throw new Error('exec_sql is intentionally disabled on the PostgreSQL backend');
        const entries = Object.entries(args);
        const values = entries.map(([, value]) => value);
        const namedArgs = entries.map(([key], index) => `${identifier(key)} => $${index + 1}`).join(', ');
        const result = await query(`SELECT public.${identifier(name)}(${namedArgs}) AS result`, values);
        return { data: result.rows[0]?.result ?? null, error: null };
      } catch (error) {
        return errorResult(error);
      }
    },
  };
}

function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error('DATA_BACKEND=supabase requires Supabase server credentials');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

let postgresAdmin: AdminContract | undefined;
let supabaseAdmin: AdminContract | undefined;

function getAdminDb(): AdminContract {
  if (process.env.DATA_BACKEND === 'postgres') {
    postgresAdmin ||= createPostgresAdmin();
    return postgresAdmin;
  }
  supabaseAdmin ||= createSupabaseAdmin() as unknown as AdminContract;
  return supabaseAdmin;
}

// Resolve credentials and the selected transport only when a request actually
// performs database work. Next.js can then collect route metadata during an
// image build without requiring either production credential set.
export const adminDb: AdminContract = {
  from(table: string) { return getAdminDb().from(table); },
  rpc(name: string, args?: Record<string, unknown>) { return getAdminDb().rpc(name, args); },
};
