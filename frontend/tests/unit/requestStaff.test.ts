/** requestJson for the staff screens: a bearer token, PATCH and bodiless POST, and the API's own message in ApiError.
 * Requirements: FR-30, FR-31, NFR-06. Decisions C2 in specs/2026-10-20-staff-screens/requirements.md.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, requestJson } from "@/lib/api/request";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response) {
  // A new Response for every call: a body can be read only once.
  const fetchStub = vi.fn(async (_address: string, _init?: RequestInit) => response.clone());
  vi.stubGlobal("fetch", fetchStub);
  return fetchStub;
}

describe("requestJson with a token", () => {
  it("sends it as a bearer header and nothing else about the user", async () => {
    const fetchStub = stubFetch(new Response("{}"));

    await requestJson("/listings", { token: "abc.def.ghi" });

    const init = fetchStub.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc.def.ghi");
    expect(init.credentials).toBe("omit");
    expect(fetchStub.mock.calls[0][0]).not.toContain("abc.def.ghi"); // never in the address
  });

  it("sends no Authorization header without a token", async () => {
    const fetchStub = stubFetch(new Response("{}"));

    await requestJson("/search");

    const init = fetchStub.mock.calls[0][1] as RequestInit;
    expect(Object.keys(init.headers as Record<string, string>)).not.toContain("Authorization");
  });
});

describe("requestJson methods", () => {
  it("is a GET by default and a POST when there is a body", async () => {
    const fetchStub = stubFetch(new Response("{}"));

    await requestJson("/a");
    await requestJson("/b", { body: { x: 1 } });

    expect((fetchStub.mock.calls[0][1] as RequestInit).method).toBeUndefined();
    expect((fetchStub.mock.calls[1][1] as RequestInit).method).toBe("POST");
  });

  it("can PATCH with a body and POST with no body", async () => {
    const fetchStub = stubFetch(new Response("{}"));

    await requestJson("/listings/1", { method: "PATCH", body: { name: "New" } });
    await requestJson("/listings/1/publish", { method: "POST" });

    const [patch, post] = fetchStub.mock.calls.map((call) => call[1] as RequestInit);
    expect(patch.method).toBe("PATCH");
    expect(patch.body).toBe(JSON.stringify({ name: "New" }));
    expect((patch.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(post.method).toBe("POST");
    expect(post.body).toBeUndefined();
    expect((post.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});

describe("ApiError", () => {
  it("carries the API's message when the answer has a text detail", async () => {
    stubFetch(new Response(JSON.stringify({ detail: "Submit needs a passing call and a passing visit first." }), { status: 400 }));

    const error = await requestJson("/x").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).detail).toBe("Submit needs a passing call and a passing visit first.");
  });

  it("has no detail when the answer's detail is a list of field errors, or is not JSON", async () => {
    stubFetch(new Response(JSON.stringify({ detail: [{ msg: "x" }] }), { status: 422 }));
    const first = (await requestJson("/x").catch((caught: unknown) => caught)) as ApiError;
    stubFetch(new Response("<html>bad gateway</html>", { status: 502 }));
    const second = (await requestJson("/x").catch((caught: unknown) => caught)) as ApiError;

    expect(first.detail).toBeNull();
    expect(second.detail).toBeNull();
    expect(second.status).toBe(502);
  });

  it("still names only the status in its own message (no address, no token)", async () => {
    stubFetch(new Response("{}", { status: 404 }));

    const error = (await requestJson("/x", { token: "secret-token" }).catch((caught: unknown) => caught)) as ApiError;

    expect(error.message).toBe("The API answered with status 404.");
  });
});
