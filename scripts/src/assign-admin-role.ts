import { db, adminRolesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const CANONICAL_ROLES = [
  "owner",
  "finance",
  "catalog",
  "kitchen",
  "support",
  "growth",
  "compliance",
  "readonly",
] as const;

type CanonicalRole = typeof CANONICAL_ROLES[number];

const isValidRole = (role: string): role is CanonicalRole => {
  return CANONICAL_ROLES.includes(role as CanonicalRole);
};

async function main() {
  const args = process.argv.slice(2);
  let userId: string | undefined;
  let role: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--user" && i + 1 < args.length) {
      userId = args[i + 1];
      i++;
    } else if (args[i] === "--role" && i + 1 < args.length) {
      role = args[i + 1];
      i++;
    }
  }

  if (!userId || !role) {
    console.error("Usage: pnpm run assign-admin-role --user <userId> --role <role>");
    process.exit(1);
  }

  if (!isValidRole(role)) {
    console.error(`Invalid role: ${role}. Must be one of: ${CANONICAL_ROLES.join(", ")}`);
    process.exit(1);
  }

  // Validate user exists
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    console.error(`User not found: ${userId}`);
    process.exit(1);
  }

  // Insert role
  const inserted = await db
    .insert(adminRolesTable)
    .values({
      userId,
      role,
      assignedBy: null, // CLI bypass
    })
    .onConflictDoNothing({ target: [adminRolesTable.userId, adminRolesTable.role] })
    .returning();

  if (inserted.length === 0) {
    console.log(`User ${userId} already has role ${role}`);
    process.exit(0);
  }

  console.log(`Successfully assigned role ${role} to user ${userId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to assign role:", err);
  process.exit(1);
});
