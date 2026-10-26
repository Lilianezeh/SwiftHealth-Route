/** The sign-up calls: the right address, method and body for each, and nothing secret in an address. Requirements: FR-48,
 * FR-49, NFR-06. Contract: specs/backend/api-spec.md section 4c. Only lib/api/account.ts calls these routes.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import * as account from "@/lib/api/account";

afterEach(() => vi.unstubAllGlobals());

function stubFetch() {
  const calls: { url: URL; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (address: string, init: RequestInit) => {
      calls.push({ url: new URL(address), init });
      return new Response("{}");
    }),
  );
  return calls;
}

const headerOf = (init: RequestInit, name: string) => (init.headers as Record<string, string>)[name];

describe("the four sign-up calls", () => {
  it("post the sign-up details, the email code, the phone code and the new-code request, with no token", async () => {
    const calls = stubFetch();

    await account.signUp({
      name: "Ada Owner",
      email: "ada@example.com",
      phone: "0803 000 0123",
      password: "river78!",
      account_type: "provider",
    });
    await account.confirmSignUpEmail("email.jwt", "482913");
    await account.confirmSignUpPhone("phone.jwt", "135790");
    await account.resendSignUpCode("email.jwt");

    expect(calls.map((call) => call.url.pathname)).toEqual([
      "/auth/signup",
      "/auth/confirm-email",
      "/auth/confirm-phone",
      "/auth/signup-resend-code",
    ]);
    expect(calls.every((call) => call.init.method === "POST")).toBe(true);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      name: "Ada Owner",
      email: "ada@example.com",
      phone: "0803 000 0123",
      password: "river78!",
      account_type: "provider",
    });
    expect(calls[1].init.body).toBe(JSON.stringify({ confirm_token: "email.jwt", code: "482913" }));
    expect(calls[2].init.body).toBe(JSON.stringify({ confirm_token: "phone.jwt", code: "135790" }));
    expect(calls[3].init.body).toBe(JSON.stringify({ confirm_token: "email.jwt" }));
    for (const call of calls) {
      expect(headerOf(call.init, "Authorization")).toBeUndefined();
      expect(call.url.search).toBe(""); // nothing secret in an address
    }
  });

  it("sends the staff note only when there is one", async () => {
    const calls = stubFetch();

    await account.signUp({
      name: "Bola Staff",
      email: "bola@example.com",
      phone: "08030000456",
      password: "river-bed-77",
      account_type: "staff",
      note: "Verifier at the clinic in Ogui.",
    });

    expect(JSON.parse(String(calls[0].init.body)).note).toBe("Verifier at the clinic in Ogui.");
  });
});
