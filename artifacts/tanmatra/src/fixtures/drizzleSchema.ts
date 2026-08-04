import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const personas = sqliteTable('personas', {
  id: text('id').primaryKey(),
  condition: text('condition', { enum: ['PCOS', 'T2D', 'HTN', 'CKD'] }).notNull(),
  diet: text('diet', { enum: ['Vegetarian', 'Vegan', 'Omnivore', 'Pescatarian'] }).notNull(),
  geography: text('geography', { enum: ['North America', 'Europe', 'Asia', 'South America'] }).notNull(),
});
