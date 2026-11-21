// The app's tools for AI clients, served by the Gateway at /mcp. They call
// the same queries as the pages, with the same rules.
import { ToolError, defineTools } from "@every-app/sdk/server";
import { z } from "zod";
import { actorOf, AppError } from "@/server/actor";
import * as library from "@/server/library";
import * as queue from "@/server/requests";

export const tools = defineTools(
  {
    list_queue: {
      description:
        "List build requests: building, in line (in order) and recently finished.",
      risk: "read",
      input: z.object({}).strict(),
      handler: (_input, { user }) => queue.listQueue(actorOf(user)),
    },
    request_build: {
      description:
        "Ask for an app to be built from a product's web address, with an optional note. Returns the existing request or library entry when the host is already covered.",
      risk: "write",
      idempotent: true,
      input: queue.submitRequestInput,
      handler: (input, { user }) =>
        refusals(() => queue.submitRequest(actorOf(user), input)),
    },
    search_library: {
      description:
        "Search the library of finished apps by text and an optional category.",
      risk: "read",
      input: library.listAppsInput,
      handler: (input, { user }) => library.listApps(actorOf(user), input),
    },
  },
  {
    instructions:
      "Call search_library before request_build: a product already in the library needs no request.",
  },
);

/** Passes the app's own refusals to the model as readable messages. */
async function refusals<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof AppError) throw new ToolError(error.message);
    throw error;
  }
}
