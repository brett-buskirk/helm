import type { Client, Project, Settings, DocumentType } from '../types';

export interface TemplateContext {
  client?: Client | null;
  project?: Project | null;
  settings?: Settings | null;
}

export const TEMPLATE_VARS: { key: string; description: string }[] = [
  { key: '{{MY_NAME}}', description: 'Your name (from Settings)' },
  { key: '{{MY_BUSINESS}}', description: 'Business name' },
  { key: '{{MY_EMAIL}}', description: 'Your email' },
  { key: '{{MY_ADDRESS}}', description: 'Your address' },
  { key: '{{CLIENT_NAME}}', description: 'Client company name' },
  { key: '{{CLIENT_CONTACT}}', description: 'Client contact name' },
  { key: '{{CLIENT_EMAIL}}', description: 'Client email' },
  { key: '{{CLIENT_ADDRESS}}', description: 'Client address' },
  { key: '{{PROJECT_NAME}}', description: 'Project name' },
  { key: '{{DATE}}', description: "Today's date (long form)" },
  { key: '{{YEAR}}', description: 'Current year' },
];

export function fillTemplate(content: string, ctx: TemplateContext): string {
  const now = new Date();
  const vals: Record<string, string> = {
    '{{MY_NAME}}': ctx.settings?.ownerName ?? '',
    '{{MY_BUSINESS}}': ctx.settings?.businessName ?? '',
    '{{MY_EMAIL}}': ctx.settings?.email ?? '',
    '{{MY_ADDRESS}}': ctx.settings?.address ?? '',
    '{{CLIENT_NAME}}': ctx.client?.company ?? '',
    '{{CLIENT_CONTACT}}': ctx.client?.contactName ?? '',
    '{{CLIENT_EMAIL}}': ctx.client?.email ?? '',
    '{{CLIENT_ADDRESS}}': ctx.client?.address ?? '',
    '{{PROJECT_NAME}}': ctx.project?.name ?? '',
    '{{DATE}}': now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    '{{YEAR}}': String(now.getFullYear()),
  };
  return Object.entries(vals).reduce((text, [key, val]) => text.split(key).join(val), content);
}

/** Starter content loaded when a user clicks "Load Starter" in the document editor. */
export const DEFAULT_TEMPLATES: Record<DocumentType, string> = {
  msa: `MASTER SERVICES AGREEMENT

This Master Services Agreement ("Agreement") is entered into as of {{DATE}}, between {{MY_BUSINESS}} ("Service Provider") and {{CLIENT_NAME}} ("Client").

1. SERVICES
Service Provider will perform services as described in individual Statements of Work ("SOWs") executed under this Agreement.

2. PAYMENT
Client agrees to pay invoices within 30 days of receipt. Late payments accrue interest at 1.5% per month.

3. INTELLECTUAL PROPERTY
Upon receipt of full payment, Client shall own all work product created solely for Client under each SOW. Service Provider retains ownership of pre-existing tools, frameworks, and general methodologies.

4. CONFIDENTIALITY
Each party agrees to keep the other's confidential information in strict confidence and not disclose it to third parties.

5. WARRANTY & LIMITATION OF LIABILITY
Service Provider warrants professional, workmanlike service. In no event shall either party's liability exceed the total fees paid under the applicable SOW in the preceding 12 months.

6. TERM & TERMINATION
This Agreement commences on the date above and continues until terminated. Either party may terminate with 30 days written notice. Outstanding invoices remain due upon termination.

7. GOVERNING LAW
This Agreement is governed by the laws of the State of [STATE].

SERVICE PROVIDER                          CLIENT

{{MY_NAME}}                               {{CLIENT_CONTACT}}
{{MY_BUSINESS}}                           {{CLIENT_NAME}}
Date: {{DATE}}                            Date: _______________`,

  nda: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of {{DATE}}, between {{MY_BUSINESS}} ("Disclosing Party") and {{CLIENT_NAME}} ("Receiving Party").

1. CONFIDENTIAL INFORMATION
"Confidential Information" means any non-public, proprietary, or sensitive information disclosed by Disclosing Party in connection with a potential business relationship.

2. OBLIGATIONS
Receiving Party agrees to: (a) hold Confidential Information in strict confidence; (b) not disclose it to third parties without prior written consent; (c) use it solely to evaluate or execute a potential engagement.

3. EXCLUSIONS
Obligations do not apply to information that: (a) becomes publicly known through no fault of Receiving Party; (b) was independently developed without reference to Confidential Information; or (c) is required to be disclosed by law.

4. TERM
Obligations under this Agreement continue for two (2) years from the date of execution.

5. GOVERNING LAW
This Agreement is governed by the laws of the State of [STATE].

DISCLOSING PARTY                          RECEIVING PARTY

{{MY_NAME}}                               {{CLIENT_CONTACT}}
{{MY_BUSINESS}}                           {{CLIENT_NAME}}
Date: {{DATE}}                            Date: _______________`,

  sow: `STATEMENT OF WORK

Project: {{PROJECT_NAME}}
Client: {{CLIENT_NAME}} — {{CLIENT_CONTACT}}
Prepared by: {{MY_NAME}}, {{MY_BUSINESS}}
Date: {{DATE}}

1. PROJECT OVERVIEW
[Describe the project, its background, and objectives.]

2. SCOPE OF WORK
[Detail the specific tasks and responsibilities included in this engagement.]

3. DELIVERABLES
[List concrete deliverables with acceptance criteria.]

4. TIMELINE
[Provide a schedule with key milestones and estimated completion date.]

5. FEES & PAYMENT
[Specify project fee, payment schedule (deposit, milestones, final), and payment terms.]

6. OUT OF SCOPE
The following items are explicitly excluded from this engagement:
- [Item 1]
- [Item 2]

7. ASSUMPTIONS & DEPENDENCIES
[List any assumptions or client dependencies required for timely delivery.]

AGREED AND ACCEPTED

{{MY_NAME}}                               {{CLIENT_CONTACT}}
{{MY_BUSINESS}}                           {{CLIENT_NAME}}
Date: {{DATE}}                            Date: _______________`,

  proposal: `PROPOSAL

To:      {{CLIENT_CONTACT}}, {{CLIENT_NAME}}
From:    {{MY_NAME}}, {{MY_BUSINESS}}
Date:    {{DATE}}
Re:      {{PROJECT_NAME}}

─────────────────────────────────────────

EXECUTIVE SUMMARY

[2–3 sentences summarizing the proposed engagement and its value to the client.]

PROPOSED SOLUTION

[Describe your approach, methodology, and why it's the right fit for this project.]

DELIVERABLES

[Enumerate what you will deliver, with clear descriptions.]

TIMELINE

[Estimated schedule from kickoff to completion.]

INVESTMENT

[Pricing — fixed fee, hourly rate, or retainer — and payment terms.]

WHY {{MY_BUSINESS}}

[Brief differentiators: relevant experience, tooling, and approach.]

NEXT STEPS

To move forward, please reply to accept this proposal. I look forward to working together.

{{MY_NAME}}
{{MY_BUSINESS}}
{{MY_EMAIL}}`,

  other: `{{DATE}}

Prepared by: {{MY_NAME}}, {{MY_BUSINESS}}
For: {{CLIENT_NAME}}

[Document content here.]`,
};
