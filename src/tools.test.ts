import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { callTool, listTools } from "@every-app/sdk/testing";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const { tools } = await import("./tools");

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

describe("tools", () => {
  it("lists each tool with its risk", async () => {
    const { tools: listed } = await listTools(tools);
    expect(listed.map(({ name, risk }) => [name, risk])).toEqual([
      ["list_queue", "read"],
      ["request_build", "write"],
      ["search_library", "read"],
    ]);
  });

  it("queues a request for the caller", async () => {
    const response = await callTool(tools, "request_build", { url: "https://gamma.example", note: "" }, { user: { id: "ana", orgRole: "member" } });
    expect(JSON.stringify(response)).toContain("created");
  });

  it("refuses a caller whose connection may only read", async () => {
    const response = await callTool(tools, "request_build", { url: "https://delta.example" }, { scopes: ["mcp:read"] });
    expect(response).toMatchObject({ error: { code: "forbidden" } });
  });
});
