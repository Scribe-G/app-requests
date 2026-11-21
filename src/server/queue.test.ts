import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

// An in-memory SQLite with the app's migrations stands in for D1.
const testDb = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/db", () => ({
  get db() {
    return testDb.current;
  },
}));

const queue = await import("./requests");
const library = await import("./library");

const ana = { id: "ana", orgId: "org1", email: "ana@example.test", admin: false };
const bo = { id: "bo", orgId: "org1", email: "bo@example.test", admin: false };
const boss = { id: "boss", orgId: "org1", email: "boss@example.test", admin: true };
const other = { id: "zed", orgId: "org2", email: "zed@example.test", admin: true };

const entry = (slug: string, inspiredBy: string, requestId: string | null = null) => ({
  name: slug,
  slug,
  purpose: "Purpose",
  inspiredBy,
  categories: ["Tools"],
  description: "Description",
  does: ["One"],
  handled: [],
  leavesOut: [],
  needs: [],
  installUrl: "https://install.example/x",
  repoUrl: "https://code.example/x",
  requestId,
});

beforeAll(async () => {
  const db = drizzle(createClient({ url: ":memory:" }), { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle", import.meta.url)),
  });
  testDb.current = db;
});

describe("queue", () => {
  it("queues by host and refuses duplicates", async () => {
    expect(await queue.submitRequest(ana, { url: "https://www.Alpha.example/x", note: "" })).toEqual({ kind: "created", host: "alpha.example" });
    expect(await queue.submitRequest(bo, { url: "alpha.example", note: "" })).toMatchObject({ kind: "requested", status: "queued" });
    await queue.submitRequest(bo, { url: "https://beta.example", note: "" });
    await expect(queue.submitRequest(bo, { url: "ftp://beta.example", note: "" })).rejects.toThrow();
    const { queued } = await queue.listQueue(ana);
    expect(queued.map((row) => [row.host, row.mine])).toEqual([["alpha.example", true], ["beta.example", false]]);
  });

  it("keeps organizations apart", async () => {
    expect((await queue.listQueue(other)).queued).toEqual([]);
    expect(await queue.submitRequest(other, { url: "alpha.example", note: "" })).toMatchObject({ kind: "created" });
  });

  it("lets only the requester withdraw, only while queued", async () => {
    const { queued } = await queue.listQueue(ana);
    const alpha = queued.find((row) => row.host === "alpha.example")!;
    await expect(queue.withdrawRequest(bo, { id: alpha.id })).rejects.toThrow();
    await expect(queue.withdrawRequest(boss, { id: alpha.id })).rejects.toThrow();
    await queue.setRequestStatus(boss, { id: alpha.id, status: "building" });
    await expect(queue.withdrawRequest(ana, { id: alpha.id })).rejects.toThrow();
    await expect(queue.setRequestStatus(ana, { id: alpha.id, status: "queued" })).rejects.toThrow();
    await expect(queue.setRequestStatus(other, { id: alpha.id, status: "declined" })).rejects.toThrow();
    expect((await queue.listQueue(ana)).building.map((row) => row.host)).toEqual(["alpha.example"]);
  });
});

describe("library", () => {
  it("publishing marks the linked request done and points new requests at it", async () => {
    const { building } = await queue.listQueue(boss);
    await expect(library.createApp(ana, entry("alpha", "alpha.example", building[0]!.id))).rejects.toThrow();
    await library.createApp(boss, entry("alpha", "alpha.example", building[0]!.id));
    const { finished } = await queue.listQueue(ana);
    expect(finished[0]).toMatchObject({ host: "alpha.example", status: "done", appSlug: "alpha" });
    expect(await queue.submitRequest(bo, { url: "https://alpha.example", note: "" })).toMatchObject({ kind: "library", slug: "alpha" });
    await expect(library.createApp(boss, entry("alpha", "x.example"))).rejects.toThrow(/slug/);
  });

  it("hides unpublished entries from members", async () => {
    const created = await library.getApp(boss, "alpha");
    await library.setPublished(boss, { id: created!.id, published: false });
    expect(await library.getApp(ana, "alpha")).toBeNull();
    expect((await library.listApps(ana, {})).apps).toEqual([]);
    expect((await library.listApps(boss, {})).apps).toHaveLength(1);
    expect(await library.getApp(other, "alpha")).toBeNull();
    await library.setPublished(boss, { id: created!.id, published: true });
    expect((await library.listApps(ana, { category: "Tools" })).categories).toEqual([{ name: "Tools", count: 1 }]);
    expect((await library.listApps(ana, { q: "nothing like it" })).apps).toEqual([]);
    await expect(library.deleteApp(ana, { id: created!.id })).rejects.toThrow();
    await library.deleteApp(boss, { id: created!.id });
    expect(await library.getApp(boss, "alpha")).toBeNull();
  });
});
