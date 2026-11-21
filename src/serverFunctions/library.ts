import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { actorOf } from "@/server/actor";
import * as library from "@/server/library";
import { linkableRequests } from "@/server/requests";

export const getLibrary = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.listAppsInput.parse(data))
  .handler(async ({ data, context }) => {
    const actor = actorOf(context.user);
    return { ...(await library.listApps(actor, data)), admin: actor.admin };
  });

export const getAppEntry = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.slugInput.parse(data))
  .handler(async ({ data, context }) => {
    const actor = actorOf(context.user);
    const entry = await library.getApp(actor, data.slug);
    return entry ? { entry, admin: actor.admin } : null;
  });

/** Admin only: what the entry form needs, with the entry when editing. */
export const getAppForm = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    library.slugInput.partial().strict().parse(data),
  )
  .handler(async ({ data, context }) => {
    const actor = actorOf(context.user);
    if (!actor.admin) return null;
    const entry = data.slug ? await library.getApp(actor, data.slug) : null;
    if (data.slug && !entry) return null;
    return { entry, requests: await linkableRequests(actor, entry?.id) };
  });

export const createApp = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.appInput.parse(data))
  .handler(({ data, context }) =>
    library.createApp(actorOf(context.user), data),
  );

export const updateApp = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.updateAppInput.parse(data))
  .handler(({ data, context }) =>
    library.updateApp(actorOf(context.user), data),
  );

export const setAppPublished = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.publishInput.parse(data))
  .handler(({ data, context }) =>
    library.setPublished(actorOf(context.user), data),
  );

export const deleteApp = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => library.appIdInput.parse(data))
  .handler(({ data, context }) =>
    library.deleteApp(actorOf(context.user), data),
  );
