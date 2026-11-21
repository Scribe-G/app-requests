import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// Every row belongs to the organization (`user.orgId`); queries filter by it.

/** A member the app has seen, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  email: text("email").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const REQUEST_STATUSES = [
  "queued",
  "building",
  "done",
  "declined",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/** A member's ask to have a product's web app built. */
export const requests = sqliteTable(
  "requests",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    host: text("host").notNull(),
    url: text("url").notNull(),
    note: text("note").notNull().default(""),
    status: text("status", { enum: REQUEST_STATUSES })
      .notNull()
      .default("queued"),
    requesterId: text("requester_id")
      .notNull()
      .references(() => users.id),
    appId: text("app_id"),
    // Milliseconds, so the order of quick submissions is exact.
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("requests_org_host").on(table.orgId, table.host),
    index("requests_org_status").on(table.orgId, table.status),
  ],
);

/** A finished app in the library. The four lists are JSON arrays of strings. */
export const apps = sqliteTable(
  "apps",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    purpose: text("purpose").notNull(),
    inspiredBy: text("inspired_by").notNull(),
    categories: text("categories", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    description: text("description").notNull(),
    does: text("does", { mode: "json" }).$type<string[]>().notNull(),
    handled: text("handled", { mode: "json" }).$type<string[]>().notNull(),
    leavesOut: text("leaves_out", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    needs: text("needs", { mode: "json" }).$type<string[]>().notNull(),
    installUrl: text("install_url").notNull(),
    repoUrl: text("repo_url").notNull(),
    published: integer("published", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("apps_org_slug").on(table.orgId, table.slug),
    index("apps_org_host").on(table.orgId, table.inspiredBy),
  ],
);
