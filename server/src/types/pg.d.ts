// Declaracao minima do driver `pg` (o pacote nao traz tipos e `@types/pg` nao e dependencia).
// Cobre so o que `database.js` usa; o pool em memoria (pg-mem) expoe a mesma interface.
// O formato das linhas e do chamador: `QueryResult<UserRow>`, com o tipo da linha como
// `@typedef` no repositorio; o padrao e `Record<string, unknown>` (nunca `any`).
declare module "pg" {
  export interface QueryResult<Row = Record<string, unknown>> {
    rows: Row[];
    rowCount: number | null;
    command: string;
  }

  export interface PoolClient {
    query<Row = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<QueryResult<Row>>;
    release(error?: Error | boolean): void;
  }

  export interface PoolConfig {
    connectionString?: string;
    ssl?: boolean | { rejectUnauthorized?: boolean; ca?: string };
    max?: number;
    connectionTimeoutMillis?: number;
    idleTimeoutMillis?: number;
    allowExitOnIdle?: boolean;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    readonly totalCount: number;
    readonly idleCount: number;
    readonly waitingCount: number;
    query<Row = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<QueryResult<Row>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
    on(event: "error", listener: (error: Error & { code?: string }) => void): this;
  }
}
