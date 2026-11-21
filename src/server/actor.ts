import { isAdmin } from "@every-app/sdk/server";
import { db } from "@/db";
import { users } from "@/db/schema";

/** The signed-in person as the queries need them. */
export interface Actor {
  id: string;
  orgId: string;
  email: string;
  admin: boolean;
}

export function actorOf(user: {
  id: string;
  orgId: string;
  email: string;
  orgRole: string;
}): Actor {
  return {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    admin: isAdmin(user),
  };
}

/** A refusal whose message the page may show. */
export class AppError extends Error {}

export function requireAdmin(actor: Actor): void {
  if (!actor.admin) throw new AppError("Only admins can do that.");
}

/** Records the member on first sight and keeps their email current. */
export async function rememberUser(actor: Actor): Promise<void> {
  await db
    .insert(users)
    .values({ id: actor.id, orgId: actor.orgId, email: actor.email })
    .onConflictDoUpdate({ target: users.id, set: { email: actor.email } });
}
