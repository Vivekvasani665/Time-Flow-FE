import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How TimeFlow collects, uses and protects your information.",
};

// Replace with the address that should receive privacy requests.
const CONTACT_EMAIL = "privacy@example.com";
const LAST_UPDATED = "September 29, 2026";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
      <div className="space-y-3 text-ink-dim leading-relaxed">{children}</div>
    </section>
  );
}

/**
 * Public, standalone page: lives outside the (app) group so it renders without
 * the dashboard shell, and is not linked from the dashboard navigation.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-dvh bg-void px-4 py-12 sm:px-6 sm:py-16">
      <article className="mx-auto max-w-3xl space-y-10">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-cyan">TimeFlow</p>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Privacy Policy</h1>
          <p className="text-sm text-ink-mute">Last updated: {LAST_UPDATED}</p>
        </header>

        <p className="text-ink-dim leading-relaxed">
          This Privacy Policy explains how TimeFlow (&quot;TimeFlow&quot;, &quot;we&quot;, &quot;us&quot;) collects, uses and
          protects information when you use our project, task and team management service. By using TimeFlow you agree
          to the practices described here.
        </p>

        <Section title="1. Information we collect">
          <p>
            <strong className="text-ink">Account information.</strong> Your name, email address, profile picture
            (if you upload one), role and the organization or workspace you belong to. Passwords are stored only as
            secure one-way hashes.
          </p>
          <p>
            <strong className="text-ink">Security information.</strong> If you enable two-factor authentication or
            passkeys, we store the data needed to verify them (such as an encrypted authenticator secret or a passkey
            public key). We never receive your device&apos;s private keys or biometric data.
          </p>
          <p>
            <strong className="text-ink">Content you create.</strong> Projects, tasks, comments, time entries, files
            you upload and other information you or your teammates add to the workspace.
          </p>
          <p>
            <strong className="text-ink">Usage and device information.</strong> Sign-in sessions, IP address, browser
            and device type (user agent), and an activity log of actions taken in the workspace, which is used for
            security and auditing.
          </p>
          <p>
            <strong className="text-ink">Communications.</strong> Emails we send you, such as invitations, password
            resets and notifications, and any messages you send to us.
          </p>
        </Section>

        <Section title="2. How we use your information">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>To provide, operate and maintain the service.</li>
            <li>To authenticate you and keep your account secure, including detecting suspicious sign-ins.</li>
            <li>To send invitations, password resets, notifications and other service-related emails.</li>
            <li>To show workspace administrators activity and audit logs for their organization.</li>
            <li>To remember your preferences, such as theme and layout density.</li>
            <li>To troubleshoot problems, improve the service and comply with legal obligations.</li>
          </ul>
          <p>We do not sell your personal information, and we do not use it for advertising.</p>
        </Section>

        <Section title="3. Cookies and local storage">
          <p>
            We use strictly necessary cookies to keep you signed in and to protect your session. We also store
            interface preferences (such as light or dark theme) in your browser&apos;s local storage. We do not use
            third-party advertising or tracking cookies.
          </p>
        </Section>

        <Section title="4. How we share information">
          <p>We share information only in these cases:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="text-ink">Within your workspace.</strong> Other members and administrators of your
              organization can see content and activity according to their roles and permissions.
            </li>
            <li>
              <strong className="text-ink">Service providers.</strong> Trusted vendors that host our infrastructure
              and deliver email on our behalf, bound by confidentiality and data-protection obligations.
            </li>
            <li>
              <strong className="text-ink">Legal reasons.</strong> When required by law, or to protect the rights,
              safety and security of TimeFlow, our users or others.
            </li>
            <li>
              <strong className="text-ink">Business transfers.</strong> In connection with a merger, acquisition or
              sale of assets, subject to this policy.
            </li>
          </ul>
        </Section>

        <Section title="5. Data retention">
          <p>
            We keep your information for as long as your account is active or as needed to provide the service. When an
            account or workspace is deleted, we delete or anonymize the related personal information within a
            reasonable period, unless we must keep it to meet legal, security or accounting requirements.
          </p>
        </Section>

        <Section title="6. Security">
          <p>
            We protect your information with industry-standard measures, including encrypted connections (HTTPS),
            hashed passwords, optional two-factor authentication and passkeys, and role-based access controls. No
            method of transmission or storage is completely secure, so we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="7. Your rights and choices">
          <p>Depending on where you live, you may have the right to:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Access and receive a copy of your personal information.</li>
            <li>Correct inaccurate information. You can update most profile details yourself in your settings.</li>
            <li>Request deletion of your account and personal information.</li>
            <li>Object to or restrict certain processing.</li>
            <li>Sign out of other devices and review your active sessions at any time.</li>
          </ul>
          <p>
            If your account is managed by an organization, some requests may need to go through your workspace
            administrator. To exercise any of these rights, contact us using the details below.
          </p>
        </Section>

        <Section title="8. Children's privacy">
          <p>
            TimeFlow is not intended for children under 16, and we do not knowingly collect personal information from
            them. If you believe a child has given us personal information, please contact us and we will delete it.
          </p>
        </Section>

        <Section title="9. International transfers">
          <p>
            Your information may be processed and stored in countries other than your own. Where we transfer data
            internationally, we take steps to ensure it remains protected in line with this policy.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We may update this Privacy Policy from time to time. When we do, we will change the &quot;Last updated&quot;
            date above and, for significant changes, notify you by email or within the service.
          </p>
        </Section>

        <Section title="11. Contact us">
          <p>
            If you have questions about this Privacy Policy or how we handle your information, email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-cyan hover:underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
      </article>
    </main>
  );
}
