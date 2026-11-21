// Shared steps for the release suites. Selectors are the app's test IDs.
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export async function openAs(runtime, role, path = "/", options = {}) {
  const page = await (await runtime.context(role, options)).newPage();
  await page.goto(path);
  return page;
}

export function row(page, host) {
  return page.locator(`[data-testid="queue-row"][data-host="${host}"]`);
}

export async function submitRequest(page, url, note = "") {
  await page.getByTestId("request-url").fill(url);
  await page.getByTestId("request-note").fill(note);
  const button = page.getByTestId("request-submit");
  await button.click();
  // The form clears once the request is saved; wait for that before the next one.
  await expect(button).not.toHaveAttribute("aria-busy", "true");
}

export async function setStatus(page, host, label) {
  await row(page, host).getByTestId("row-status-select").click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

export async function fillAppForm(page, values) {
  const fields = {
    name: "f-name",
    slug: "f-slug",
    purpose: "f-purpose",
    inspiredBy: "f-inspired",
    categories: "f-categories",
    description: "f-description",
    does: "f-does",
    handled: "f-handled",
    leavesOut: "f-leaves",
    needs: "f-needs",
    installUrl: "f-install",
    repoUrl: "f-repo",
  };
  for (const [key, testId] of Object.entries(fields)) {
    if (values[key] !== undefined) await page.getByTestId(testId).fill(values[key]);
  }
  if (values.request) {
    await page.getByTestId("f-request").click();
    await page.getByRole("option", { name: values.request }).click();
  }
}

/** Runs `action` and returns the server-function request it sent. */
export async function captureServerCall(page, action) {
  const [request] = await Promise.all([
    page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/_serverFn/")),
    action(),
  ]);
  const headers = { ...request.headers() };
  delete headers.cookie;
  return { path: new URL(request.url()).pathname + new URL(request.url()).search, headers, body: request.postData() };
}

/** Sends a captured server-function call again as another role. */
export function replay(runtime, call, role, body = call.body) {
  return runtime.fetch(call.path, { role, method: "POST", headers: call.headers, body });
}

export async function queryRows(runtime, sql, ...params) {
  const db = await runtime.database();
  const { results } = await db.prepare(sql).bind(...params).all();
  return results;
}

export { expect };

/**
 * A server function refused the call: an HTTP error, or (as TanStack Start
 * answers a thrown error) a 200 whose body carries the serialized error.
 */
export async function expectRefused(response, label = "call") {
  const body = await response.text();
  const refused = response.status >= 400 || (response.status === 200 && body.includes("$TSR/Error"));
  expect(refused, `${label} was not refused: ${response.status} ${body.slice(0, 300)}`).toBe(true);
}
