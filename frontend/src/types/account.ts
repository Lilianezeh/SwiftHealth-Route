/** API types of the sign-up. Contract: specs/backend/api-spec.md section 4c (FR-48, FR-49; decision D20). */

/** "staff" makes a verifier who waits for an admin; "provider" is a facility owner (the API's own word). */
export type AccountType = "staff" | "provider";

export type SignUpInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  account_type: AccountType;
  note?: string; // staff only: who they are and who can vouch for them (500 characters at most)
};

/** The answer of sign-up and of "send a new code": the token of the code just sent, and where it went (masked). */
export type SignUpStarted = { confirm_token: string; sent_to: string };

/** The answer of "confirm email". With Termii live: `phone_code_sent` with the token and hint of the phone code. Without Termii
 * the sign-up is finished (`active` or `waiting_for_approval`) and there is no token. */
export type EmailConfirmed = {
  status: "phone_code_sent" | "active" | "waiting_for_approval";
  confirm_token?: string;
  sent_to?: string;
};

/** The answer of "confirm phone": the sign-up is finished. */
export type SignUpOutcome = { status: "active" | "waiting_for_approval" };
