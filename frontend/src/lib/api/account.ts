/** The sign-up and account calls of the API, from the browser. Requirements: FR-48, FR-49, FR-54, NFR-06. Contract: api-spec,
 * sections 4c and 4d. The only code that calls these routes. The sign-up calls carry no token (the person has no account yet);
 * the self-service calls under /account carry the login token in the header. Nothing secret goes in an address: the password
 * and the codes are in the body.
 */
import { requestJson, type RequestOptions } from "@/lib/api/request";
import type {
  AccountDetails,
  ContactStep,
  EmailConfirmed,
  ForgotStep,
  PasswordChanged,
  SignUpInput,
  SignUpOutcome,
  SignUpStarted,
} from "@/types/account";

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

/** Self-service (accounts phase 5, api-spec 4d). The routes under /account carry the login token in the header, never in an
 * address; the password, the codes and the new values are in the body. */
export function getAccount(token: string, options: Options = {}): Promise<AccountDetails> {
  return requestJson<AccountDetails>("/account", { ...options, token });
}

export function changeName(token: string, name: string, options: Options = {}): Promise<AccountDetails> {
  return requestJson<AccountDetails>("/account", { ...options, token, method: "PATCH", body: { name } });
}

export function startEmailChange(token: string, email: string, options: Options = {}): Promise<ContactStep> {
  return requestJson<ContactStep>("/account/email/start", { ...options, token, body: { email } });
}

export function confirmEmailChange(token: string, confirmToken: string, code: string, options: Options = {}): Promise<AccountDetails> {
  return requestJson<AccountDetails>("/account/email/confirm", { ...options, token, body: { confirm_token: confirmToken, code } });
}

export function startPhoneChange(token: string, phone: string, options: Options = {}): Promise<ContactStep> {
  return requestJson<ContactStep>("/account/phone/start", { ...options, token, body: { phone } });
}

export function confirmPhoneChange(token: string, confirmToken: string, code: string, options: Options = {}): Promise<AccountDetails> {
  return requestJson<AccountDetails>("/account/phone/confirm", { ...options, token, body: { confirm_token: confirmToken, code } });
}

export function changePassword(token: string, currentPassword: string, newPassword: string, options: Options = {}): Promise<PasswordChanged> {
  return requestJson<PasswordChanged>("/account/password", {
    ...options,
    token,
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export function closeAccount(token: string, password: string, options: Options = {}): Promise<{ closed: boolean }> {
  return requestJson<{ closed: boolean }>("/account/close", { ...options, token, body: { password, confirmation: "CLOSE" } });
}

/** "I forgot my password": no login; the answer is the same for every email. */
export function forgotPassword(email: string, options: Options = {}): Promise<ForgotStep> {
  return requestJson<ForgotStep>("/auth/forgot-password", { ...options, body: { email } });
}

/** Sets the new password with the emailed code. It does not log the person in. */
export function resetPassword(resetToken: string, code: string, newPassword: string, options: Options = {}): Promise<{ reset: boolean }> {
  return requestJson<{ reset: boolean }>("/auth/reset-password", {
    ...options,
    body: { reset_token: resetToken, code, new_password: newPassword },
  });
}

/** A new code for the step the token belongs to (60 seconds after the last one, 5 an hour). */
export function resendSignUpCode(confirmToken: string, options: Options = {}): Promise<SignUpStarted> {
  return requestJson<SignUpStarted>("/auth/signup-resend-code", { ...options, body: { confirm_token: confirmToken } });
}
