import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { personas } from './drizzleSchema';
import { eq, and } from 'drizzle-orm';
import * as crypto from 'crypto';

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite);

export async function createSyntheticUser(condition: string, geography: string, diet: string = 'Veg') {
  const personaList = await db.select().from(personas).where(
    and(
      eq(personas.condition, condition),
      eq(personas.geography, geography),
      eq(personas.diet, diet)
    )
  ).limit(1);

  if (personaList.length === 0) {
    throw new Error(`Persona not found for ${condition}, ${geography}, ${diet}`);
  }

  const basePersona = personaList[0];
  
  // Create a synthetic user without production PHI
  const syntheticUser = {
    userId: crypto.randomUUID(),
    name: `Test User ${basePersona.condition} ${basePersona.geography}`,
    email: `test_${basePersona.id}@example.com`,
    phone: `+9199999${Math.floor(10000 + Math.random() * 90000)}`,
    clinicalProfile: {
      condition: basePersona.condition,
      diet: basePersona.diet,
    },
    location: {
      geography: basePersona.geography,
      // Provide synthetic safe GPS out-of-zone pivot data if needed
      isOutOfZone: false 
    }
  };

  return syntheticUser;
}
