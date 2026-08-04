import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { personas } from './drizzleSchema';
import * as crypto from 'crypto';

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite);

const CONDITIONS = ['PCOS', 'T2D', 'HTN', 'CKD'];
const DIETS = ['Veg', 'Egg', 'Vegan'];
const GEOGRAPHIES = ['Tier1', 'Tier2'];

async function seed() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS personas (
      id TEXT PRIMARY KEY,
      condition TEXT NOT NULL,
      diet TEXT NOT NULL,
      geography TEXT NOT NULL
    );
  `);
  
  sqlite.exec('DELETE FROM personas;');

  const data = [];
  for (const condition of CONDITIONS) {
    for (const diet of DIETS) {
      for (const geography of GEOGRAPHIES) {
        data.push({
          id: crypto.randomUUID(),
          condition,
          diet,
          geography,
        });
      }
    }
  }

  await db.insert(personas).values(data);
  console.log(`Seeded ${data.length} persona combinations.`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
