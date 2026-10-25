// @vitest-environment jsdom
/** The sign-up step kept for the tab, so the confirm page knows where to go on. Requirements: FR-48, NFR-06, NFR-07.
 * Only the code token, where it went (masked), the account type and the moment a new code may be asked for: never the
 * password, never the code typed, never the email or the phone in full. `sessionStorage`, gone when the tab closes.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { clearSignUpStep, readSignUpStep, saveSignUpStep, SIGNUP_STEP_KEY } from "@/lib/account/signupStep";

beforeEach(() => window.sessionStorage.clear());

const STEP = { step: "email", token: "email.jwt", sentTo: "a***@example.com", kind: "provider", readyAt: 1_700_000_060_000 } as const;

describe("the saved sign-up step", () => {
  it("is read back as it was saved", () => {
    saveSignUpStep(STEP);

    expect(readSignUpStep()).toEqual(STEP);
  });

  it("is null when nothing was saved, and after it is cleared", () => {
    expect(readSignUpStep()).toBeNull();
    saveSignUpStep(STEP);
    clearSignUpStep();

    expect(readSignUpStep()).toBeNull();
  });

  it("is kept in sessionStorage only: never localStorage", () => {
    saveSignUpStep(STEP);

    expect(window.sessionStorage.getItem(SIGNUP_STEP_KEY)).not.toBeNull();
    expect(window.localStorage.length).toBe(0);
  });

  it("holds only the five known fields: no password, no code, no email, no phone", () => {
    saveSignUpStep({ ...STEP, password: "river78!", code: "123456" } as never);

    expect(Object.keys(JSON.parse(window.sessionStorage.getItem(SIGNUP_STEP_KEY) ?? "{}")).sort()).toEqual(
      ["kind", "readyAt", "sentTo", "step", "token"],
    );
  });

  it.each(["not json", "42", "null", JSON.stringify({ step: "email" }), JSON.stringify({ ...STEP, step: "other" }), JSON.stringify({ ...STEP, kind: "admin" })])(
    "treats a damaged value (%s) as nothing saved",
    (stored) => {
      window.sessionStorage.setItem(SIGNUP_STEP_KEY, stored);

      expect(readSignUpStep()).toBeNull();
    },
  );

  it("copes with a storage that throws (private mode): nothing saved, nothing thrown", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() => saveSignUpStep(STEP)).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
    expect(readSignUpStep()).toBeNull();
  });
});
