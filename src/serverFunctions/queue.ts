import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { actorOf, rememberUser } from "@/server/actor";
import * as queue from "@/server/requests";

export const getQueue = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context }) => {
    const actor = actorOf(context.user);
    await rememberUser(actor);
    return { ...(await queue.listQueue(actor)), admin: actor.admin };
  });

export const submitRequest = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => queue.submitRequestInput.parse(data))
  .handler(({ data, context }) =>
    queue.submitRequest(actorOf(context.user), data),
  );

export const withdrawRequest = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => queue.requestIdInput.parse(data))
  .handler(({ data, context }) =>
    queue.withdrawRequest(actorOf(context.user), data),
  );

export const setRequestStatus = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => queue.setStatusInput.parse(data))
  .handler(({ data, context }) =>
    queue.setRequestStatus(actorOf(context.user), data),
  );
