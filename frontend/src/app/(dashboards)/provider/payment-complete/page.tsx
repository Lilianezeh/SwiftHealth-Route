/** Where Paystack sends the provider back, `/provider/payment-complete` (provider role only). Requirements: FR-44, FR-46. UI spec 4.4.
 * Paystack adds `reference` (and `trxref`) to the address; the page only reads it. The reference is not a secret, and the page
 * shows "confirmed" only when the API says the signed webhook has been applied. */
import { StaffGate } from "@/components/admin/StaffGate";
import { PaymentComplete } from "@/components/provider/PaymentComplete";

type PaymentSearch = { reference?: string; trxref?: string };

export default async function PaymentCompletePage({ searchParams }: { searchParams: Promise<PaymentSearch> }) {
  const { reference, trxref } = await searchParams;
  const found = (reference ?? trxref ?? "").trim();
  return (
    <StaffGate area="provider">
      <PaymentComplete reference={found === "" ? null : found} />
    </StaffGate>
  );
}
