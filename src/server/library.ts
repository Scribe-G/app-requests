import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apps, requests } from "@/db/schema";
import { httpUrl, normalizeHost } from "@/shared/urls";
import { AppError, requireAdmin, type Actor } from "./actor";

const line = z.string().trim().min(1).max(300);
const list = z.array(line).max(40);
const link = z
  .string()
  .max(2000)
  .transform((value, ctx) => {
    const url = httpUrl(value);
    if (!url) {
      ctx.addIssue({ code: "custom", message: "Links must start with http:// or https://." });
      return z.NEVER;
    }
    return url;
  });

export const appInput = z
  .object({
    name: z.string().trim().min(1, "Give it a name.").max(80),
    slug: z
      .string()
      .trim()
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        "Slugs use lowercase letters, numbers and dashes.",
      )
      .max(60),
    purpose: z.string().trim().min(1, "Add a one-line purpose.").max(160),
    inspiredBy: z
      .string()
      .max(2000)
      .transform((value, ctx) => {
        const host = normalizeHost(value);
        if (!host) {
          ctx.addIssue({ code: "custom", message: "Enter the address that inspired it." });
          return z.NEVER;
        }
        return host;
      }),
    categories: z.array(z.string().trim().min(1).max(40)).min(1, "Add at least one category.").max(8),
    description: z.string().trim().min(1, "Add a description.").max(5000),
    does: list,
    handled: list,
    leavesOut: list,
    needs: list,
    installUrl: link,
    repoUrl: link,
    requestId: z.string().uuid().nullable(),
  })
  .strict();
export const updateAppInput = z
  .object({ id: z.string().uuid(), app: appInput })
  .strict();
export const appIdInput = z.object({ id: z.string().uuid() }).strict();
export const publishInput = z
  .object({ id: z.string().uuid(), published: z.boolean() })
  .strict();
export const listAppsInput = z
  .object({
    q: z.string().max(200).optional(),
    category: z.string().max(40).optional(),
  })
  .strict();
export const slugInput = z.object({ slug: z.string().max(60) }).strict();

type AppInput = z.infer<typeof appInput>;

const card = {
  id: apps.id,
  slug: apps.slug,
  name: apps.name,
  purpose: apps.purpose,
  inspiredBy: apps.inspiredBy,
  categories: apps.categories,
  published: apps.published,
};

/** Library cards the actor may see, filtered, with each category's count. */
export async function listApps(
  actor: Actor,
  { q, category }: z.infer<typeof listAppsInput>,
) {
  const rows = await db
    .select(card)
    .from(apps)
    .where(
      actor.admin
        ? eq(apps.orgId, actor.orgId)
        : and(eq(apps.orgId, actor.orgId), eq(apps.published, true)),
    )
    .orderBy(asc(apps.name), asc(apps.id));

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.published) continue;
    for (const name of row.categories) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const needle = q?.trim().toLowerCase() ?? "";
  const shown = rows.filter(
    (row) =>
      (!category || row.categories.includes(category)) &&
      (!needle ||
        [row.name, row.purpose, row.inspiredBy].some((text) =>
          text.toLowerCase().includes(needle),
        )),
  );
  return {
    apps: shown,
    total: rows.length,
    categories: [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** One entry by slug; unpublished entries only for admins. */
export async function getApp(actor: Actor, slug: string) {
  const [entry] = await db
    .select()
    .from(apps)
    .where(and(eq(apps.orgId, actor.orgId), eq(apps.slug, slug)))
    .limit(1);
  if (!entry || (!entry.published && !actor.admin)) return null;
  const [linked] = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.orgId, actor.orgId), eq(requests.appId, entry.id)))
    .limit(1);
  const { orgId: _org, ...shown } = entry;
  return { ...shown, requestId: linked?.id ?? null };
}

async function assertSlugFree(actor: Actor, slug: string, except?: string) {
  const [taken] = await db
    .select({ id: apps.id })
    .from(apps)
    .where(
      and(
        eq(apps.orgId, actor.orgId),
        eq(apps.slug, slug),
        except ? ne(apps.id, except) : undefined,
      ),
    )
    .limit(1);
  if (taken) throw new AppError("Another entry already uses that slug.");
}

async function assertRequestLinkable(actor: Actor, requestId: string | null) {
  if (!requestId) return;
  const [request] = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.orgId, actor.orgId)))
    .limit(1);
  if (!request) throw new AppError("That request is gone.");
}

function linkRequest(actor: Actor, appId: string, requestId: string, now: number) {
  return db
    .update(requests)
    .set({ status: "done", appId, updatedAt: now })
    .where(and(eq(requests.id, requestId), eq(requests.orgId, actor.orgId)));
}

function unlinkOthers(actor: Actor, appId: string, keep: string | null) {
  return db
    .update(requests)
    .set({ appId: null })
    .where(
      and(
        eq(requests.orgId, actor.orgId),
        eq(requests.appId, appId),
        keep ? ne(requests.id, keep) : undefined,
      ),
    );
}

/** Admin only: publishes a new entry and marks its request done. */
export async function createApp(actor: Actor, input: AppInput) {
  requireAdmin(actor);
  await assertSlugFree(actor, input.slug);
  await assertRequestLinkable(actor, input.requestId);
  const { requestId, ...fields } = input;
  const id = crypto.randomUUID();
  const now = Date.now();
  const insert = db.insert(apps).values({
    ...fields,
    id,
    orgId: actor.orgId,
    published: true,
    createdAt: now,
    updatedAt: now,
  });
  if (requestId) await db.batch([insert, linkRequest(actor, id, requestId, now)]);
  else await insert;
  return { slug: input.slug };
}

/** Admin only: changes an entry, and its linked request. */
export async function updateApp(
  actor: Actor,
  { id, app: input }: z.infer<typeof updateAppInput>,
) {
  requireAdmin(actor);
  await assertSlugFree(actor, input.slug, id);
  await assertRequestLinkable(actor, input.requestId);
  const { requestId, ...fields } = input;
  const now = Date.now();
  const [found] = await db
    .select({ id: apps.id })
    .from(apps)
    .where(and(eq(apps.id, id), eq(apps.orgId, actor.orgId)))
    .limit(1);
  if (!found) throw new AppError("That entry is gone.");
  const update = db
    .update(apps)
    .set({ ...fields, updatedAt: now })
    .where(and(eq(apps.id, id), eq(apps.orgId, actor.orgId)));
  const unlink = unlinkOthers(actor, id, requestId);
  if (requestId) {
    await db.batch([update, unlink, linkRequest(actor, id, requestId, now)]);
  } else {
    await db.batch([update, unlink]);
  }
  return { slug: input.slug };
}

/** Admin only: hides an entry from members, or shows it again. */
export async function setPublished(
  actor: Actor,
  { id, published }: z.infer<typeof publishInput>,
) {
  requireAdmin(actor);
  const updated = await db
    .update(apps)
    .set({ published, updatedAt: Date.now() })
    .where(and(eq(apps.id, id), eq(apps.orgId, actor.orgId)))
    .returning({ id: apps.id });
  if (updated.length === 0) throw new AppError("That entry is gone.");
}

/** Admin only: deletes an entry for good; its request keeps its status. */
export async function deleteApp(actor: Actor, { id }: z.infer<typeof appIdInput>) {
  requireAdmin(actor);
  const [found] = await db
    .select({ id: apps.id })
    .from(apps)
    .where(and(eq(apps.id, id), eq(apps.orgId, actor.orgId)))
    .limit(1);
  if (!found) throw new AppError("That entry is gone.");
  await db.batch([
    unlinkOthers(actor, id, null),
    db.delete(apps).where(and(eq(apps.id, id), eq(apps.orgId, actor.orgId))),
  ]);
}
