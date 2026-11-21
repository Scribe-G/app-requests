// Authorization: private paths, ownership of requests, admin-only curation,
// and no sign-in of the app's own (X001).
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";
import { captureServerCall, expect, expectRefused, fillAppForm, openAs, queryRows, replay, row, setStatus, submitRequest } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  // Anonymous callers and other organizations are refused everywhere.
  await runtime.assertPrivateAccess(["/", "/library"]);
  for (const path of ["/", "/library", "/library/new", "/library/anything"]) {
    for (const role of [undefined, "outsider"]) {
      const response = await runtime.fetch(path, { role });
      expect(response.status, `${path} as ${role ?? "anonymous"}`).not.toBe(200);
    }
  }

  // No sign-in, sign-up or password page of the app's own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/register", "/logout", "/account"]) {
    const response = await runtime.fetch(path, { role: "member" });
    const body = await response.text();
    expect(body, path).not.toMatch(/type="password"/i);
    expect(body.toLowerCase(), path).not.toContain("forgot password");
  }
  const home = await (await runtime.fetch("/", { role: "member" })).text();
  expect(home).not.toMatch(/type="password"/i);

  // The member's request; the owner's request.
  const member = await openAs(runtime, "member", "/");
  await submitRequest(member, "https://crewcal.example/");
  await expect(row(member, "crewcal.example")).toBeVisible();
  const owner = await openAs(runtime, "owner", "/");
  await submitRequest(owner, "https://deskbook.example/");
  await expect(row(owner, "deskbook.example")).toBeVisible();
  await member.reload();
  await expect(row(member, "deskbook.example")).toBeVisible();
  // Only the requester gets a withdraw control.
  await expect(row(member, "deskbook.example").getByTestId("row-withdraw")).toHaveCount(0);
  await expect(row(owner, "crewcal.example").getByTestId("row-withdraw")).toHaveCount(0);

  // A withdraw call replayed by someone else is refused and changes nothing.
  const withdraw = await captureServerCall(owner, () => row(owner, "deskbook.example").getByTestId("row-withdraw").click());
  await expect(row(owner, "deskbook.example")).toHaveCount(0);
  await submitRequest(owner, "https://deskbook.example/");
  await expect(row(owner, "deskbook.example")).toBeVisible();
  const [crewcal] = await queryRows(runtime, "select id from requests where host = ?", "crewcal.example");
  const [deskbook] = await queryRows(runtime, "select id from requests where host = ?", "deskbook.example");
  const memberRequestBody = withdraw.body.split(extractId(withdraw.body)).join(crewcal.id);
  const refused = await replay(runtime, withdraw, "owner", memberRequestBody);
  await expectRefused(refused, "withdraw by another member");
  expect(await queryRows(runtime, "select id from requests where id = ?", crewcal.id)).toHaveLength(1);
  const refused2 = await replay(runtime, withdraw, "member", withdraw.body.split(extractId(withdraw.body)).join(deskbook.id));
  await expectRefused(refused2, "withdraw of the owner's request");
  expect(await queryRows(runtime, "select id from requests where id = ?", deskbook.id)).toHaveLength(1);

  // Status changes are admin-only: the member gets no control, and a replayed call is refused.
  await expect(row(member, "crewcal.example").getByTestId("row-status-select")).toHaveCount(0);
  await owner.reload();
  const statusCall = await captureServerCall(owner, () => setStatus(owner, "deskbook.example", "Building"));
  await expect(row(owner, "deskbook.example").getByTestId("row-status")).toHaveText("Building");
  const declineMember = statusCall.body.split(deskbook.id).join(crewcal.id).replace(/building/g, "declined");
  const statusRefused = await replay(runtime, statusCall, "member", declineMember);
  await expectRefused(statusRefused, "status change by a member");
  expect((await queryRows(runtime, "select status from requests where id = ?", crewcal.id))[0].status).toBe("queued");
  const outsiderCall = await runtime.fetch(statusCall.path, { role: "outsider", method: "POST", headers: statusCall.headers, body: declineMember });
  expect(outsiderCall.status).not.toBe(200);
  expect((await queryRows(runtime, "select status from requests where id = ?", crewcal.id))[0].status).toBe("queued");

  // The same replay as the admin goes through, so the refusals above are the app's.
  const allowed = await replay(runtime, statusCall, "owner", statusCall.body.replace(/building/g, "declined"));
  expect(allowed.status).toBe(200);
  expect((await queryRows(runtime, "select status from requests where id = ?", deskbook.id))[0].status).toBe("declined");

  // Curation is admin-only.
  await owner.goto("/library/new");
  await fillAppForm(owner, {
    name: "Crew Calendar",
    purpose: "Plan shifts for a small crew.",
    inspiredBy: "crewcal.example",
    categories: "Scheduling",
    description: "A shared calendar of shifts.",
    does: "Weekly shift grid",
    handled: "Sign-in",
    leavesOut: "Payroll",
    needs: "",
    installUrl: "https://gateway.example/install/crew-calendar",
    repoUrl: "https://code.example/acme/crew-calendar",
  });
  const saveCall = await captureServerCall(owner, () => owner.getByTestId("f-save").click());
  await owner.waitForURL("**/library/crew-calendar");
  const [entry] = await queryRows(runtime, "select id from apps where slug = ?", "crew-calendar");

  // A member creating an entry by replay is refused.
  const forged = saveCall.body.split("crew-calendar").join("member-made");
  await expectRefused(await replay(runtime, saveCall, "member", forged), "create by a member");
  expect(await queryRows(runtime, "select id from apps where slug = ?", "member-made")).toHaveLength(0);

  // Unpublish and delete calls replayed by a member are refused.
  const unpublish = await captureServerCall(owner, () => owner.getByTestId("toggle-publish").click());
  await expect(owner.getByTestId("app-unpublished")).toBeVisible();
  await owner.getByTestId("toggle-publish").click();
  await expect(owner.getByTestId("app-unpublished")).toHaveCount(0);
  await expectRefused(await replay(runtime, unpublish, "member"), "unpublish by a member");
  expect((await queryRows(runtime, "select published from apps where id = ?", entry.id))[0].published).toBe(1);

  await owner.getByTestId("delete-app").click();
  const del = await captureServerCall(owner, () => owner.getByRole("button", { name: "Delete", exact: true }).click());
  await owner.waitForURL("**/library");
  expect(await queryRows(runtime, "select id from apps where id = ?", entry.id)).toHaveLength(0);
  // Recreate it, then have the member replay the delete against it.
  await owner.goto("/library/new");
  await fillAppForm(owner, {
    name: "Crew Calendar", purpose: "Plan shifts for a small crew.", inspiredBy: "crewcal.example", categories: "Scheduling",
    description: "A shared calendar of shifts.", does: "Weekly shift grid", handled: "Sign-in", leavesOut: "Payroll", needs: "",
    installUrl: "https://gateway.example/install/crew-calendar", repoUrl: "https://code.example/acme/crew-calendar",
  });
  await Promise.all([owner.waitForURL("**/library/crew-calendar"), owner.getByTestId("f-save").click()]);
  const [again] = await queryRows(runtime, "select id from apps where slug = ?", "crew-calendar");
  await expectRefused(await replay(runtime, del, "member", del.body.split(entry.id).join(again.id)), "delete by a member");
  expect(await queryRows(runtime, "select id from apps where id = ?", again.id)).toHaveLength(1);

  // Members can't reach the curation pages or see admin controls.
  await member.goto("/library/new");
  await expect(member.getByTestId("f-save")).toHaveCount(0);
  await member.goto("/library/crew-calendar/edit");
  await expect(member.getByTestId("f-save")).toHaveCount(0);
  await member.goto("/library/crew-calendar");
  await expect(member.getByTestId("app-name")).toHaveText("Crew Calendar");
  for (const id of ["edit-app", "toggle-publish", "delete-app"]) await expect(member.getByTestId(id)).toHaveCount(0);
  await member.goto("/library");
  await expect(member.getByTestId("add-app")).toHaveCount(0);

  // Unpublished entries are hidden from members, by page and by search.
  await owner.goto("/library/crew-calendar");
  await owner.getByTestId("toggle-publish").click();
  await expect(owner.getByTestId("app-unpublished")).toBeVisible();
  await member.goto("/library");
  await expect(member.getByTestId("app-card")).toHaveCount(0);
  await member.goto("/library/crew-calendar");
  await expect(member.getByTestId("app-name")).toHaveCount(0);
  const raw = await (await runtime.fetch("/library/crew-calendar", { role: "member" })).text();
  expect(raw).not.toContain("Plan shifts for a small crew.");
} finally {
  await runtime.close();
}

/** The first UUID in a server-function body: the id the call acted on. */
function extractId(body) {
  const match = body.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  if (!match) throw new Error(`No id in ${body}`);
  return match[0];
}
