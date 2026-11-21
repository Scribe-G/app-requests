// Behavior: the request queue (F001), the library (F002) and curation (F003).
import { startRuntime } from "/home/user/oss-new/control/runtime/index.mjs";
import { expect, fillAppForm, openAs, row, setStatus, submitRequest } from "./helpers.mjs";

const runtime = await startRuntime();
try {
  await runtime.assertPrivateAccess(["/", "/library"]);

  // F001: a member asks for builds.
  const member = await openAs(runtime, "member", "/");
  await runtime.assertBackLink(member);
  await expect(member.getByRole("heading", { level: 1 })).toBeVisible();

  await submitRequest(member, "ftp://files.example.com/share");
  await expect(member.getByTestId("request-error")).toBeVisible();
  await submitRequest(member, "not a web address");
  await expect(member.getByTestId("request-error")).toBeVisible();

  await submitRequest(member, "https://www.Pollster.example/pricing?plan=team", "We pay for it per seat and only use the survey part.");
  await expect(row(member, "pollster.example")).toBeVisible();
  await expect(row(member, "pollster.example").getByTestId("row-status")).toHaveText("Queued");
  await expect(row(member, "pollster.example").getByTestId("row-position")).toHaveText("Next");
  await expect(row(member, "pollster.example").getByTestId("row-requester")).toHaveText("member@example.test");
  await expect(member.getByTestId("count-queued")).toHaveText("1");
  await expect(member.getByTestId("count-building")).toHaveText("0");

  // The same host again shows the existing request, not a second one.
  await submitRequest(member, "http://POLLSTER.example/");
  await expect(member.getByTestId("request-duplicate")).toContainText("pollster.example");
  await expect(member.locator('[data-testid="queue-row"][data-host="pollster.example"]')).toHaveCount(1);
  await expect(member.getByTestId("count-queued")).toHaveText("1");

  await submitRequest(member, "https://formdrop.example/");
  await submitRequest(member, "https://app.shiftboard.example/schedule");
  await expect(row(member, "formdrop.example").getByTestId("row-position")).toHaveText("2nd");
  await expect(row(member, "app.shiftboard.example").getByTestId("row-position")).toHaveText("3rd");
  await expect(member.getByTestId("count-queued")).toHaveText("3");

  // The requester withdraws their own queued request.
  await row(member, "app.shiftboard.example").getByTestId("row-withdraw").click();
  await expect(row(member, "app.shiftboard.example")).toHaveCount(0);
  await expect(member.getByTestId("count-queued")).toHaveText("2");

  // Members get no status control; the owner (an admin) does.
  await expect(row(member, "pollster.example").getByTestId("row-status-select")).toHaveCount(0);
  const owner = await openAs(runtime, "owner", "/");
  await expect(row(owner, "pollster.example").getByTestId("row-withdraw")).toHaveCount(0);
  await setStatus(owner, "pollster.example", "Building");
  await expect(owner.getByTestId("queue-building").locator('[data-host="pollster.example"]')).toBeVisible();
  await expect(row(owner, "pollster.example").getByTestId("row-status")).toHaveText("Building");
  await expect(owner.getByTestId("count-building")).toHaveText("1");
  await expect(owner.getByTestId("count-queued")).toHaveText("1");
  await expect(row(owner, "formdrop.example").getByTestId("row-position")).toHaveText("Next");
  // A building request can no longer be withdrawn.
  await member.reload();
  await expect(row(member, "pollster.example").getByTestId("row-withdraw")).toHaveCount(0);

  // F003: the admin publishes the finished app and links it to the request.
  await owner.goto("/library");
  await Promise.all([owner.waitForURL("**/library/new"), owner.getByTestId("add-app").click()]);
  await fillAppForm(owner, {
    name: "Team Surveys",
    purpose: "Run short surveys and read the answers in one place.",
    inspiredBy: "https://pollster.example",
    categories: "Surveys, Feedback",
    description: "Write a survey, share its link with your team and watch the answers come in as a chart for each question.",
    does: "Build surveys with choice, rating and text questions\nCollect answers from every member\nChart the results per question",
    handled: "Sign-in and who can open it\nHosting on your own account",
    leavesOut: "Anonymous public surveys\nPaid survey panels",
    needs: "",
    installUrl: "https://gateway.example/install/team-surveys",
    repoUrl: "https://code.example/acme/team-surveys",
    request: "pollster.example",
  });
  await expect(owner.getByTestId("f-slug")).toHaveValue("team-surveys");
  await Promise.all([owner.waitForURL("**/library/team-surveys"), owner.getByTestId("f-save").click()]);
  await expect(owner.getByTestId("app-name")).toHaveText("Team Surveys");

  // A second app in another category; a duplicate slug is refused first.
  await owner.goto("/library/new");
  await fillAppForm(owner, {
    name: "Team Surveys",
    purpose: "Collect form submissions and route them to the right person.",
    inspiredBy: "formdrop.example",
    categories: "Forms",
    description: "Make a form, send its link around, and see every submission in a table.",
    does: "Forms with text, choice and file fields\nA table of every submission",
    handled: "Sign-in",
    leavesOut: "Payments inside forms",
    needs: "A mail sender for notifications",
    installUrl: "https://gateway.example/install/form-inbox",
    repoUrl: "https://code.example/acme/form-inbox",
  });
  await owner.getByTestId("f-save").click();
  await expect(owner.getByTestId("form-error")).toBeVisible();
  await fillAppForm(owner, { name: "Form Inbox", slug: "form-inbox" });
  await Promise.all([owner.waitForURL("**/library/form-inbox"), owner.getByTestId("f-save").click()]);

  // The linked request is done and links to its entry.
  await owner.goto("/");
  await expect(owner.getByTestId("queue-finished").locator('[data-host="pollster.example"]')).toBeVisible();
  await expect(row(owner, "pollster.example").getByTestId("row-status")).toHaveText("Done");
  await expect(row(owner, "pollster.example").getByTestId("row-app-link")).toHaveAttribute("href", "/library/team-surveys");
  await expect(owner.getByTestId("count-building")).toHaveText("0");

  // F002: members browse, search and filter.
  await member.goto("/library");
  await runtime.assertBackLink(member);
  await expect(member.getByTestId("app-card")).toHaveCount(2);
  const card = member.locator('[data-testid="app-card"][data-slug="team-surveys"]');
  await expect(card).toContainText("Team Surveys");
  await expect(card).toContainText("Run short surveys and read the answers in one place.");
  await expect(card).toContainText("pollster.example");
  await expect(card).toContainText("Feedback");
  await expect(member.locator('[data-testid="category-filter"][data-category="Surveys"] [data-testid="category-count"]')).toHaveText("1");
  await expect(member.locator('[data-testid="category-filter"][data-category="Forms"] [data-testid="category-count"]')).toHaveText("1");

  await member.getByTestId("library-search").fill("formdrop");
  await expect(member.getByTestId("app-card")).toHaveCount(1);
  await expect(member.locator('[data-testid="app-card"][data-slug="form-inbox"]')).toBeVisible();
  await member.getByTestId("library-search").fill("answers in one place");
  await expect(member.getByTestId("app-card")).toHaveCount(1);
  await expect(card).toBeVisible();
  await member.locator('[data-testid="category-filter"][data-category="Forms"]').click();
  await expect(member.getByTestId("app-card")).toHaveCount(0);
  await expect(member.getByTestId("library-empty")).toBeVisible();
  await member.getByTestId("library-search").fill("");
  await expect(member.getByTestId("app-card")).toHaveCount(1);
  await expect(member.locator('[data-testid="app-card"][data-slug="form-inbox"]')).toBeVisible();

  await member.goto("/library");
  await Promise.all([member.waitForURL("**/library/team-surveys"), card.click()]);
  await expect(member.getByTestId("app-name")).toHaveText("Team Surveys");
  await expect(member.getByTestId("app-purpose")).toHaveText("Run short surveys and read the answers in one place.");
  await expect(member.getByTestId("app-categories")).toContainText("Surveys");
  await expect(member.getByTestId("app-description")).toContainText("watch the answers come in");
  await expect(member.getByTestId("list-does").locator("li")).toHaveCount(3);
  await expect(member.getByTestId("list-handled").locator("li")).toHaveCount(2);
  await expect(member.getByTestId("list-leaves-out").locator("li")).toHaveCount(2);
  await expect(member.getByTestId("list-needs")).toContainText("Nothing");
  const install = member.getByTestId("install-link");
  await expect(install).toHaveAttribute("href", "https://gateway.example/install/team-surveys");
  await expect(install).toHaveAttribute("target", "_blank");
  await expect(member.getByTestId("repo-link")).toHaveAttribute("href", "https://code.example/acme/team-surveys");
  await expect(member.getByTestId("repo-link")).toHaveAttribute("target", "_blank");
  await expect(member.getByTestId("edit-app")).toHaveCount(0);
  await expect(member.getByTestId("delete-app")).toHaveCount(0);
  await member.goto("/library/form-inbox");
  await expect(member.getByTestId("list-needs").locator("li")).toHaveText("A mail sender for notifications");

  // A host already in the library points at the entry instead of queueing.
  await member.goto("/");
  await submitRequest(member, "https://pollster.example/");
  await expect(member.getByTestId("request-duplicate").getByRole("link")).toHaveAttribute("href", "/library/team-surveys");

  // F003: edit, unpublish, delete.
  await owner.goto("/library/team-surveys");
  await Promise.all([owner.waitForURL("**/library/team-surveys/edit"), owner.getByTestId("edit-app").click()]);
  await expect(owner.getByTestId("f-does")).toHaveValue(/Collect answers from every member/);
  await fillAppForm(owner, { purpose: "Run short team surveys and read every answer in one place." });
  await Promise.all([owner.waitForURL("**/library/team-surveys"), owner.getByTestId("f-save").click()]);
  await expect(owner.getByTestId("app-purpose")).toHaveText("Run short team surveys and read every answer in one place.");

  await owner.goto("/library/form-inbox");
  await owner.getByTestId("toggle-publish").click();
  await expect(owner.getByTestId("app-unpublished")).toBeVisible();
  await member.goto("/library");
  await expect(member.getByTestId("app-card")).toHaveCount(1);
  await expect(member.locator('[data-testid="category-filter"][data-category="Forms"]')).toHaveCount(0);
  await member.goto("/library/form-inbox");
  await expect(member.getByTestId("app-name")).toHaveCount(0);
  await owner.goto("/library");
  await expect(owner.locator('[data-testid="app-card"][data-slug="form-inbox"]')).toContainText("Unpublished");

  await owner.goto("/library/form-inbox");
  await owner.getByTestId("delete-app").click();
  await Promise.all([owner.waitForURL("**/library"), owner.getByRole("button", { name: "Delete", exact: true }).click()]);
  await expect(owner.locator('[data-testid="app-card"][data-slug="form-inbox"]')).toHaveCount(0);
  await expect(owner.getByTestId("app-card")).toHaveCount(1);

  // The admin declines one and starts another.
  await owner.goto("/");
  await setStatus(owner, "formdrop.example", "Declined");
  await expect(owner.getByTestId("queue-finished").locator('[data-host="formdrop.example"]')).toBeVisible();
  await expect(row(owner, "formdrop.example").getByTestId("row-status")).toHaveText("Declined");

  // Phone-sized smoke.
  const phone = await openAs(runtime, "member", "/", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await expect(phone.getByTestId("request-url")).toBeVisible();
  await expect(row(phone, "pollster.example")).toBeVisible();
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  // The journey's picture: a busy queue as a member sees it.
  await member.goto("/");
  await submitRequest(member, "https://www.tasklane.example/", "Our project board; we only need lists and due dates.");
  await submitRequest(member, "https://pagebeacon.example/", "Status page for the API.");
  await submitRequest(member, "https://invoicely.example/");
  await owner.goto("/");
  await setStatus(owner, "tasklane.example", "Building");
  await expect(row(owner, "tasklane.example").getByTestId("row-status")).toHaveText("Building");
  await member.goto("/");
  await expect(row(member, "tasklane.example").getByTestId("row-status")).toHaveText("Building");
  await expect(row(member, "pagebeacon.example").getByTestId("row-position")).toHaveText("Next");
  await expect(row(member, "invoicely.example").getByTestId("row-position")).toHaveText("2nd");
  await runtime.screenshot(member);
} finally {
  await runtime.close();
}
