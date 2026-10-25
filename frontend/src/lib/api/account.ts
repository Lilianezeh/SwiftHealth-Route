/** The sign-up calls of the API, from the browser. Requirements: FR-48, FR-49, NFR-06. Contract: api-spec, section 4c.
 * The only code that calls these routes. None carries a token (the person has no account yet), and nothing secret goes in an
 * address: the password and the codes are in the body.
 */
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type { EmailConfirmed, SignUpInput, SignUpOutcome, SignUpStarted } from "@/types/account";

type Options = Omit<RequestOptions, "token" | "body" | "method">;

/** Makes the account (not usable yet) and emails the first code. */
export function signUp(input: SignUpInput, options: Options = {}): Promise<SignUpStarted> {
  return requestJson<SignUpStarted>("/auth/signup", { ...options, body: input });
}

/** The code of the email. With Termii live a code is texted to the phone; without it the sign-up ends here. */
export function confirmSignUpEmail(confirmToken: string, code: string, options: Options = {}): Promise<EmailConfirmed> {
  return requestJson<EmailConfirmed>("/auth/confirm-email", { ...options, body: { confirm_token: confirmToken, code } });
}

/** The code of the phone (only reached when Termii is live). */
export function confirmSignUpPhone(confirmToken: string, code: string, options: Options = {}): Promise<SignUpOutcome> {
  return requestJson<SignUpOutcome>("/auth/confirm-phone", { ...options, body: { confirm_token: confirmToken, code } });
}

/** A new code for the step the token belongs to (60 seconds after the last one, 5 an hour). */
export function resendSignUpCode(confirmToken: string, options: Options = {}): Promise<SignUpStarted> {
  return requestJson<SignUpStarted>("/auth/signup-resend-code", { ...options, body: { confirm_token: confirmToken } });
}
