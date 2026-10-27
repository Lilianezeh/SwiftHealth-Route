/** Privacy `/privacy`. Requirements: FR-23, NFR-07, NFR-13, FR-24; accounts phase 9 (requirements section 6 of
 * specs/2026-10-23-accounts-and-facility-ownership/). UI spec 2.10; decision D1 in specs/2026-10-20-info-pages/requirements.md.
 * A plain statement of what the product does with data today, each line from a requirement or the code. It makes no legal claim and
 * has not been reviewed by a lawyer (the notice says so). When a feature changes what is kept, this page changes with it. */
import type { Metadata } from "next";

import { DraftNotice, InfoLink, InfoPage, InfoSection } from "@/components/info/InfoPage";
import { brand } from "@/config/brand";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `What ${brand.name} keeps about you: your position is never stored, an account keeps only what it needs, a report's phone number is optional and deleted, and we do not sell personal data.`,
};

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy policy">
      <DraftNotice />
      <InfoSection heading="Your position">
        <p>
          When you ask for places near you, your position is sent with that search to show the nearest ones. We do not store your position, and it is
          left out of our logs. It is never put in a web address.
        </p>
        <p>
          Your browser keeps your position, rounded to about 100 metres, for as long as the tab is open, so you do not have to allow it again on every
          page. It is gone when you close the tab.
        </p>
        <p>
          When you tap &ldquo;Share my location&rdquo; in {siteConfig.emergencyName}, the exact position is put into a message that you send yourself, by WhatsApp or
          SMS. We never receive it and never store it.
        </p>
      </InfoSection>
      <InfoSection heading="Reports">
        <p>
          When you report a problem with a listing, we keep the reason and the comment you wrote. Your phone number is optional: give it only if you
          want us to follow up. Your phone number is deleted when the report is closed.
        </p>
        <p>
          To count how many different people reported the same listing, we keep a scrambled code made from your phone number, or from your network
          address if you gave no number. The code cannot be turned back into either. It is deleted when the report is closed, too.
        </p>
      </InfoSection>
      <InfoSection heading="Accounts">
        <p>
          Anyone who wants to list or manage a facility can sign up for an account, and our staff have accounts too. For an account we keep your name,
          email address and phone number; a password that is kept only as a scrambled code, never as the password; the kind of account (facility owner,
          verifier, editor or admin); whether it is approved; when the email and phone were confirmed; and the last time you logged in. When staff sign
          up, we also keep the short note they wrote about who they are.
        </p>
        <p>
          If you switch on the authenticator app, its secret is kept in an encrypted form, and your backup codes are kept only as scrambled codes.
        </p>
        <p>We use this for running the account, keeping it secure and checking who may change which listing.</p>
      </InfoSection>
      <InfoSection heading="Codes and unfinished sign-ups">
        <p>
          Codes that we send by email or SMS, to confirm an address or a phone, to log in or to reset a password, are not stored by us: each one
          travels inside a short-lived signed message and is checked when you send it back.
        </p>
        <p>A sign-up whose email or phone is not confirmed within 7 days is removed by a clean-up job.</p>
      </InfoSection>
      <InfoSection heading="Facilities you list or manage">
        <p>
          When you register a facility or ask to manage one, we keep the details you give, your request, the reason you wrote while the request
          waits, and who approved it. Our team may phone the facility to check that you may manage it.
        </p>
        <p>
          Your contact details are those of your account. They are never put in the listing, and only staff can see them. The facility&apos;s name,
          address, phone numbers and hours are shown to everyone once the listing is published.
        </p>
      </InfoSection>
      <InfoSection heading="Moves, closures and branches">
        <p>
          When a facility moves, we keep the old and the new address, who changed it and when. A moved facility is hidden until our team checks the new
          address. When a facility closes, we keep the reason. A closed facility is hidden, never deleted.
        </p>
        <p>A facility can be a branch of a bigger one. A branch shows the name of its main facility.</p>
      </InfoSection>
      <InfoSection heading="The activity log">
        <p>
          Every change to a listing and every decision about an account is recorded with who made it and when. Staff are included: their actions are
          recorded and shown to admins. These records are kept.
        </p>
      </InfoSection>
      <InfoSection heading="Closing your account">
        <p>
          You can close your account yourself in My account. Your name, email address and phone number are replaced, your password and codes are
          removed, and the account is turned off. The activity records stay, without your name.
        </p>
      </InfoSection>
      <InfoSection heading="Payments">
        <p>
          A featured listing is paid for on Paystack&apos;s own page. We never see your card. We keep Paystack&apos;s payment reference and the date until which
          the listing is featured.
        </p>
      </InfoSection>
      <InfoSection heading="Services we use">
        <p>
          To run the site we use Netlify, which hosts the website; Render, which hosts the service and the database; Resend, which sends email; Termii,
          which sends SMS codes; Cloudinary, which stores the photos that staff upload; and Paystack, which takes payments. Some of them are outside
          Nigeria.
        </p>
        <p>
          Each one receives only what it needs for its job: for example Termii receives a phone number and the code to send, and Resend an email address
          and the message.
        </p>
      </InfoSection>
      <InfoSection heading="What your browser keeps">
        <p>
          {siteConfig.emergencyName} keeps a copy of the emergency contacts in your browser, so the page also opens with no network. The copy holds the
          names and numbers of facilities, and no position.
        </p>
        <p>
          When you log in, your browser keeps your login in the tab only; it is gone when you close the tab. We set no cookies and run no analytics or
          tracking scripts.
        </p>
      </InfoSection>
      <InfoSection heading="What we do not do">
        <p>We do not sell personal data. Visitors do not need an account, and we do not ask for one.</p>
      </InfoSection>
      <InfoSection heading="Questions">
        <p>
          To ask what we hold about you, to correct it, or to close your account, use My account or contact us. How fast we answer, and what the law
          requires us to do, will be added after a lawyer has read this page.
        </p>
        <InfoLink href="/contact">Contact us</InfoLink>
      </InfoSection>
    </InfoPage>
  );
}
