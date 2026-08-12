import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { SQLWrapper } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type BatchStatement = SQLWrapper & {
  execute(): Promise<unknown>;
};

export type TestDatabase = ReturnType<typeof drizzle> & {
  batch<T extends readonly BatchStatement[]>(statements: T): Promise<unknown[]>;
  applyMigrations(options?: {
    after?: string;
    through?: string;
  }): void;
};

type MigrationEntry = { tag: string };

function getMigrationEntries(migrationsDir: string): MigrationEntry[] {
  const journalPath = join(migrationsDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: MigrationEntry[];
  };
  return journal.entries;
}

function applyMigrationRange(
  sqlite: Database,
  migrationsDir: string,
  options: { after?: string; through?: string } = {},
) {
  const entries = getMigrationEntries(migrationsDir);
  const afterIndex = options.after
    ? entries.findIndex(({ tag }) => tag === options.after)
    : -1;
  const throughIndex = options.through
    ? entries.findIndex(({ tag }) => tag === options.through)
    : entries.length - 1;

  if (options.after && afterIndex < 0) {
    throw new Error(`Unknown starting migration: ${options.after}`);
  }
  if (options.through && throughIndex < 0) {
    throw new Error(`Unknown ending migration: ${options.through}`);
  }

  for (const { tag } of entries.slice(afterIndex + 1, throughIndex + 1)) {
    const migrationPath = join(migrationsDir, `${tag}.sql`);
    const migration = readFileSync(migrationPath, "utf8");

    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        sqlite.run(statement);
      }
    }
  }
}

export function createTestDb(options: { through?: string } = {}): TestDatabase {
  const sqlite = new Database(":memory:");
  const migrationsDir = join(import.meta.dir, "../../drizzle");
  applyMigrationRange(sqlite, migrationsDir, { through: options.through });

  const db = drizzle(sqlite);

  return Object.assign(db, {
    batch<T extends readonly BatchStatement[]>(statements: T) {
      const executeBatch = sqlite.transaction(() =>
        statements.map((statement) => statement.execute()),
      );

      return Promise.all(executeBatch());
    },
    applyMigrations(options?: { after?: string; through?: string }) {
      applyMigrationRange(sqlite, migrationsDir, options);
    },
  });
}
