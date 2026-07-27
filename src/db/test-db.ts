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
};

export function createTestDb(): TestDatabase {
  const sqlite = new Database(":memory:");
  const migrationsDir = join(import.meta.dir, "../../drizzle");
  const journalPath = join(migrationsDir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: Array<{ tag: string }>;
  };

  for (const { tag } of journal.entries) {
    const migrationPath = join(migrationsDir, `${tag}.sql`);
    const migration = readFileSync(migrationPath, "utf8");

    for (const statement of migration.split("--> statement-breakpoint")) {
      if (statement.trim()) {
        sqlite.run(statement);
      }
    }
  }

  const db = drizzle(sqlite);

  return Object.assign(db, {
    batch<T extends readonly BatchStatement[]>(statements: T) {
      const executeBatch = sqlite.transaction(() =>
        statements.map((statement) => statement.execute()),
      );

      return Promise.all(executeBatch());
    },
  });
}
