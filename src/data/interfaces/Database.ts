/**
 * Database interface for abstraction over different database implementations
 * Allows swapping between SQLite, in-memory, or other database backends
 */
export interface Database {
  /**
   * Execute a SQL statement that doesn't return data (INSERT, UPDATE, DELETE)
   */
  run(sql: string, params?: unknown[]): RunResult;

  /**
   * Execute a SQL query and return the first row
   */
  get<T>(sql: string, params?: unknown[]): T | undefined;

  /**
   * Execute a SQL query and return all rows
   */
  all<T>(sql: string, params?: unknown[]): T[];

  /**
   * Execute multiple SQL statements (for initialization)
   */
  exec(sql: string): void;

  /**
   * Close the database connection
   */
  close(): void;
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}
