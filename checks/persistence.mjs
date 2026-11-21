// Persistence: requests, statuses and library entries survive a restart.
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";
import { expect, fillAppForm, openAs, row, setStatus, submitRequest } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  const member = await openAs(runtime, "member", "/");
  await submitRequest(member, "https://www.ledgerly.example/home", "Shared expenses for the office.");
  await submitRequest(member, "https://notepath.example/");
  await expect(row(member, "notepath.example").getByTestId("row-position")).toHaveText("2nd");

  const owner = await openAs(runtime, "owner", "/");
  await setStatus(owner, "notepath.example", "Building");
  await expect(row(owner, "notepath.example").getByTestId("row-status")).toHaveText("Building");
  await owner.goto("/library/new");
  await fillAppForm(owner, {
    name: "Office Expenses",
    purpose: "Split and settle shared office costs.",
    inspiredBy: "ledgerly.example",
    categories: "Finance",
    description: "Log what the office spends and see who owes what.",
    does: "Log expenses\nSettle balances",
    handled: "Sign-in",
    leavesOut: "Bank sync",
    needs: "",
    installUrl: "https://gateway.example/install/office-expenses",
    repoUrl: "https://code.example/acme/office-expenses",
    request: "ledgerly.example",
  });
  await Promise.all([owner.waitForURL("**/library/office-expenses"), owner.getByTestId("f-save").click()]);

  await runtime.restart();

  const after = await openAs(runtime, "member", "/");
  await expect(row(after, "notepath.example").getByTestId("row-status")).toHaveText("Building");
  await expect(row(after, "ledgerly.example").getByTestId("row-status")).toHaveText("Done");
  await expect(row(after, "ledgerly.example").getByTestId("row-requester")).toHaveText("member@example.test");
  await after.goto("/library/office-expenses");
  await expect(after.getByTestId("app-name")).toHaveText("Office Expenses");
  await expect(after.getByTestId("list-does").locator("li")).toHaveCount(2);
} finally {
  await runtime.close();
}
