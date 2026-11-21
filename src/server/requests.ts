import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apps, REQUEST_STATUSES, requests, users } from "@/db/schema";
import type { RequestStatus } from "@/db/schema";
import { normalizeHost } from "@/shared/urls";
import { AppError, rememberUser, requireAdmin, type Actor } from "./actor";

export const submitRequestInput = z
  .object({
    url: z.string().max(2000),
    note: z.string().trim().max(500).default(""),
  })
  .strict();
export const requestIdInput = z.object({ id: z.string().uuid() }).strict();
export const setStatusInput = z
  .object({ id: z.string().uuid(), status: z.enum(REQUEST_STATUSES) })
  .strict();

export interface QueueRow {
  id: string;
  host: string;
  note: string;
  status: RequestStatus;
  requester: string;
  mine: boolean;
  appSlug: string | null;
}

export type SubmitResult =
  | { kind: "created"; host: string }
  | { kind: "requested"; host: string; status: RequestStatus }
  | { kind: "library"; host: string; slug: string; name: string };

const RECENT_FINISHED = 10;

/**
 * Queues a request for the host of `url`, or returns what already covers
 * that host: a published library entry, then an existing request.
 */
export async function submitRequest(
  actor: Actor,
  input: z.infer<typeof submitRequestInput>,
): Promise<SubmitResult> {
  const host = normalizeHost(input.url);
  if (!host) throw new AppError("Enter a web address such as https://example.com.");

  const existing = await findExisting(actor.orgId, host);
  if (existing) return existing;

  await rememberUser(actor);
  const now = Date.now();
  const inserted = await db
    .insert(requests)
    .values({
      id: crypto.randomUUID(),
      orgId: actor.orgId,
      host,
      url: input.url.trim(),
      note: input.note,
      requesterId: actor.id,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: requests.id });
  if (inserted.length === 0) {
    // Someone asked for the same host a moment earlier.
    const raced = await findExisting(actor.orgId, host);
    if (raced) return raced;
  }
  return { kind: "created", host };
}

async function findExisting(
  orgId: string,
  host: string,
): Promise<SubmitResult | null> {
  const [entry] = await db
    .select({ slug: apps.slug, name: apps.name })
    .from(apps)
    .where(
      and(
        eq(apps.orgId, orgId),
        eq(apps.inspiredBy, host),
        eq(apps.published, true),
      ),
    )
    .limit(1);
  if (entry) return { kind: "library", host, ...entry };
  const [request] = await db
    .select({ status: requests.status })
    .from(requests)
    .where(and(eq(requests.orgId, orgId), eq(requests.host, host)))
    .limit(1);
  if (request) return { kind: "requested", host, status: request.status };
  return null;
}

/** The shared queue: building, in line (in order), and recently finished. */
export async function listQueue(actor: Actor) {
  const rows = await db
    .select({
      id: requests.id,
      host: requests.host,
      note: requests.note,
      status: requests.status,
      requesterId: requests.requesterId,
      requester: users.email,
      createdAt: requests.createdAt,
      updatedAt: requests.updatedAt,
      appSlug: apps.slug,
      appPublished: apps.published,
    })
    .from(requests)
    .innerJoin(users, eq(users.id, requests.requesterId))
    .leftJoin(
      apps,
      and(eq(apps.id, requests.appId), eq(apps.orgId, requests.orgId)),
    )
    .where(eq(requests.orgId, actor.orgId))
    .orderBy(asc(requests.createdAt), asc(requests.id));

  const shown = (row: (typeof rows)[number]): QueueRow => ({
    id: row.id,
    host: row.host,
    note: row.note,
    status: row.status,
    requester: row.requester,
    mine: row.requesterId === actor.id,
    appSlug:
      row.status === "done" &&
      row.appSlug &&
      (row.appPublished || actor.admin)
        ? row.appSlug
        : null,
  });

  const building = rows
    .filter((row) => row.status === "building")
    .sort((a, b) => a.updatedAt - b.updatedAt)
    .map(shown);
  const queued = rows.filter((row) => row.status === "queued").map(shown);
  const finished = rows
    .filter((row) => row.status === "done" || row.status === "declined")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECENT_FINISHED)
    .map(shown);
  return { building, queued, finished };
}

/** Deletes the actor's own request while it is still queued. */
export async function withdrawRequest(
  actor: Actor,
  { id }: z.infer<typeof requestIdInput>,
): Promise<void> {
  const deleted = await db
    .delete(requests)
    .where(
      and(
        eq(requests.id, id),
        eq(requests.orgId, actor.orgId),
        eq(requests.requesterId, actor.id),
        eq(requests.status, "queued"),
      ),
    )
    .returning({ id: requests.id });
  if (deleted.length === 0) {
    throw new AppError("Only your own queued requests can be withdrawn.");
  }
}

/** Admin only: moves a request to another status. */
export async function setRequestStatus(
  actor: Actor,
  { id, status }: z.infer<typeof setStatusInput>,
): Promise<void> {
  requireAdmin(actor);
  const updated = await db
    .update(requests)
    .set({ status, updatedAt: Date.now() })
    .where(and(eq(requests.id, id), eq(requests.orgId, actor.orgId)))
    .returning({ id: requests.id });
  if (updated.length === 0) throw new AppError("That request is gone.");
}

/** Admin only: requests a new library entry may be linked to. */
export async function linkableRequests(actor: Actor, appId?: string) {
  requireAdmin(actor);
  const rows = await db
    .select({ id: requests.id, host: requests.host, appId: requests.appId })
    .from(requests)
    .where(
      and(
        eq(requests.orgId, actor.orgId),
        inArray(requests.status, ["queued", "building", "done"]),
      ),
    )
    .orderBy(desc(requests.updatedAt));
  return rows
    .filter((row) => !row.appId || row.appId === appId)
    .map(({ id, host }) => ({ id, host }));
}
