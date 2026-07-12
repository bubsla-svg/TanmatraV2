import {
  pgTable,
  varchar,
  integer,
  timestamp,
  text,
  doublePrecision,
  boolean,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export type DietaryStyle =
  | "omnivore"
  | "vegetarian"
  | "vegan"
  | "pescatarian"
  | "keto";

export type SpiceLevel = "none" | "mild" | "medium" | "hot";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type WellnessGoal =
  | "lose_weight"
  | "maintain"
  | "gain_muscle"
  | "general_wellness";

export type ClinicalContraindication =
  | "hypertension"
  | "diabetes"
  | "gerd"
  | "kidney_disease"
  | "celiac"
  | "pregnancy";

export const userPreferencesTable = pgTable("user_preferences", {
  userId: varchar("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  allergens: text("allergens").array().notNull().default([]),
  dislikedIngredients: text("disliked_ingredients").array().notNull().default([]),
  medicalConditions: text("medical_conditions").array().notNull().default([]),
  cuisines: text("cuisines").array().notNull().default([]),
  spiceLevel: varchar("spice_level", { length: 16 })
    .$type<SpiceLevel>()
    .notNull()
    .default("medium"),
  dietaryStyle: varchar("dietary_style", { length: 16 })
    .$type<DietaryStyle>()
    .notNull()
    .default("omnivore"),
  goal: varchar("goal", { length: 24 })
    .$type<WellnessGoal>()
    .notNull()
    .default("general_wellness"),
  activityLevel: varchar("activity_level", { length: 16 })
    .$type<ActivityLevel>()
    .notNull()
    .default("moderate"),
  calorieTarget: integer("calorie_target"),
  proteinTargetGrams: integer("protein_target_grams"),
  carbsTargetGrams: integer("carbs_target_grams"),
  fatTargetGrams: integer("fat_target_grams"),
  hba1cPct: doublePrecision("hba1c_pct"),
  pcosHistory: boolean("pcos_history"),
  heightCm: integer("height_cm"),
  weightKg: doublePrecision("weight_kg"),
  quizCompletedAt: timestamp("quiz_completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type UserPreferences = typeof userPreferencesTable.$inferSelect;
