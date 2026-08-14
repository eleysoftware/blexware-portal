import {
  BLEX_PREPARED_BY,
  formatMoney,
  type EstimateLineItem,
  type ProjectDocument,
} from "@/lib/documents/types";

/**
 * The real Build Financial Wellness engagement, transcribed from the signed-off
 * proposal document so it can move through the BLEXware workflow end to end.
 */
export const BFW_CLIENT = {
  name: "Tamara West",
  title: "Founder & CEO",
  company: "Build Financial Wellness",
  email: "tamara.west9194@gmail.com",
  phone: "(317) 551-0737",
};

export const BFW_LINE_ITEMS: EstimateLineItem[] = [
  { label: "Phase 1 – Navigation Enhancements", amountCents: 10000, durationLabel: "2–3 days" },
  {
    label: "Phase 2 – Services Section Redesign & Hero Optimization",
    amountCents: 15000,
    durationLabel: "2–3 days",
  },
  { label: "Phase 3 – Resource Center Redesign", amountCents: 35000, durationLabel: "5–7 days" },
  {
    label: "Phase 4 – Newsletter Module",
    amountCents: 30000,
    note: "$0 – previously paid",
    durationLabel: "5–7 days",
  },
  { label: "Phase 5 – Financial Tools Library", amountCents: 25000, durationLabel: "5–7 days" },
  { label: "Phase 6 – Contact Section Enhancements", amountCents: 12500, durationLabel: "2–3 days" },
  { label: "Phase 7 – Website Administration", amountCents: 32500, durationLabel: "5–7 days" },
];

export const BFW_SUBTOTAL_CENTS = 130000;
export const BFW_DISCOUNT_CENTS = 26000; // Preferred Client Loyalty Discount (20%)
export const BFW_TOTAL_CENTS = 104000;

export const BFW_QUOTE_INTAKE = {
  projectType: "Website enhancement",
  industry: "Financial services & coaching",
  services: ["Web application development", "UX & product design", "Content administration tooling"],
  goals:
    "Enhance the existing buildyourfinancialwellness.com website: clearer navigation, modernized services presentation, an expanded Resource Library, a Newsletter module, a Financial Tools Library, and administrative tools for ongoing content management.",
  features:
    "Navigation rename and Client Login CTA, Services redesign with Simply Coach scheduling, Hero optimization for the free Financial Check-In, Resource Center with Tools/Newsletters tabs, Newsletter publishing, four downloadable financial tools, Savings Reset Kit contact flow, hidden administrator area.",
  budget: "$1,000 – $2,500",
  timeline: "24–36 business days",
};

export function buildBfwProposalDoc(): ProjectDocument {
  return {
    kind: "proposal",
    title: "BUILD FINANCIAL WELLNESS",
    subtitle: "Website Enhancement Proposal & Project Estimate",
    clientName: BFW_CLIENT.company,
    date: "August 2026",
    preparedFor: BFW_CLIENT,
    preparedBy: BLEX_PREPARED_BY,
    facts: [
      { label: "Total Project Investment", value: formatMoney(BFW_TOTAL_CENTS) },
      { label: "Estimated Start", value: "August 24–30, 2026" },
      { label: "Duration", value: "24–36 business days" },
    ],
    confidentialFooter: true,
    sections: [
      {
        heading: "Executive Summary",
        body: [
          "This proposal outlines enhancements to the existing Build Financial Wellness website, buildyourfinancialwellness.com, based on the June 29, 2026 planning meeting and subsequent project discussions and revisions.",
          "The project is focused on enhancing the existing website rather than developing a new website. The enhancements will improve website navigation, clarify the presentation of Build Financial Wellness services, expand the Resource Library, improve the visitor experience, and provide administrative tools for managing website content.",
          "The project also includes optimization of the homepage Hero section to more clearly communicate the purpose and value of the Financial Check-In, as well as updating the business phone number from a toll-free number to a local number.",
          "The Newsletter Module was previously paid for under an earlier agreement and is included in this proposal at no additional charge; the remaining work for that module is estimated and scheduled as part of this project.",
          "The separate B2B Membership Portal remains outside the scope of this proposal and is addressed separately in Proposal #2.",
        ],
      },
      {
        heading: "Project Objectives",
        body: ["The primary objectives of this enhancement project are to:"],
        bullets: [
          "Improve website navigation and user experience",
          "Modernize the Services section",
          "Clarify the homepage Hero-section call-to-action",
          "Clearly communicate the Financial Check-In experience to visitors",
          "Expand and reorganize the Resource Library",
          "Provide a dedicated Newsletter management system",
          "Create an organized Financial Tools Library",
          "Improve the Contact section",
          "Update the business phone number from toll-free to local",
          "Provide administrative functionality for ongoing website content management",
        ],
      },
      {
        heading: "Phase 1 – Navigation Enhancements",
        level: 2,
        body: [
          "Objective: improve website navigation to better reflect the evolving structure and functionality of the Build Financial Wellness website.",
        ],
        bullets: [
          "Rename Support to Resources",
          "Rename the Resources submenu to Resource Library",
          "Replace the Book a Free Consultation navigation CTA with Client Login",
          "Update NuvolaSoft branding to BLEXware",
          "Update associated routing and navigation logic",
        ],
      },
      {
        heading: "Phase 2 – Services Section Redesign & Hero Optimization",
        level: 2,
        body: [
          "Objective: update the Services section to better reflect current services and the coaching platform, and improve visitor understanding of the Financial Check-In.",
        ],
        bullets: [
          "Remove Build Journey, Budget Build and Budget Mixer",
          "Replace with Individuals / Households and Employees / Organizations",
          "Update CTA links and replace Acuity scheduling with Simply Coach",
          'Replace the "Get Started" button with "Get Your Free Financial Check-In"',
          'Add supporting text: "Receive your free five-minute Financial Check-In to help you reflect, gain clarity, and discover your next financial step."',
          "Maintain the existing clean design and visual balance of the Hero section",
        ],
      },
      {
        heading: "Phase 3 – Resource Center Redesign",
        level: 2,
        body: [
          "Objective: redesign the Resources page to support two primary resource types while maintaining the clean, professional appearance of the current website.",
        ],
        bullets: [
          "New Resources landing page",
          "Tab navigation: Tools | Newsletters, with Tools as the default view",
          "Fully responsive layout",
          "Pagination for Newsletters",
          "Resource thumbnails",
          "Individual resource detail pages",
          "Updated navigation",
        ],
      },
      {
        heading: "Phase 4 – Newsletter Module",
        level: 2,
        body: ["Objective: replace the original Blog concept with a dedicated Newsletter system."],
        bullets: [
          "Public newsletter listing with pagination and thumbnails",
          "Newsletter detail page",
          "Create, edit and delete newsletters",
          "Publish / unpublish newsletters",
        ],
        note: "Previously paid under an earlier project agreement. Original estimated value $300 | Additional cost $0 | Estimated duration 5–7 days.",
      },
      {
        heading: "Phase 5 – Financial Tools Library",
        level: 2,
        body: [
          "Objective: provide downloadable financial resources through an organized and user-friendly resource library.",
        ],
        bullets: [
          "Four downloadable financial tools",
          "Download confirmation workflow",
          "Download management",
          "Administrative upload capability",
        ],
        note: "The downloadable financial tools will not be used as lead generators; the previously proposed lead-capture functionality has been removed from this phase.",
      },
      {
        heading: "Phase 6 – Contact Section Enhancements",
        level: 2,
        body: [
          "Objective: improve the website's Contact section while supporting the distribution of the Savings Reset Kit.",
        ],
        bullets: [
          "Replace the newsletter download with the Savings Reset Kit",
          "Make First Name optional and remove Last Name",
          "Require Email Address",
          "Provide an administrator-managed downloadable PDF",
          "Update the business phone number from toll-free to the new local number",
        ],
      },
      {
        heading: "Phase 7 – Website Administration",
        level: 2,
        body: [
          "Objective: provide a secure administrative area allowing ongoing management of website content and downloadable resources.",
        ],
        bullets: [
          "Newsletter management",
          "Financial Tools management",
          "Downloadable PDF management",
          "Hidden administrator login",
        ],
      },
      {
        heading: "Project Investment & Pricing",
        body: [
          "The pricing below reflects the estimated effort required to complete each website enhancement phase. As a valued returning client, Build Financial Wellness is receiving Preferred Client Loyalty Pricing, including credit for the Newsletter Module previously paid for under an earlier agreement.",
        ],
        table: {
          columns: ["Project Phase", "Investment"],
          numeric: true,
          rows: [
            ...BFW_LINE_ITEMS.map((item) => [
              item.note ? `${item.label} (${item.note})` : item.label,
              formatMoney(item.amountCents),
            ]),
            ["Project Subtotal", formatMoney(BFW_SUBTOTAL_CENTS)],
            ["Preferred Client Loyalty Discount (20%)", `–${formatMoney(BFW_DISCOUNT_CENTS)}`],
            ["Total Project Investment", formatMoney(BFW_TOTAL_CENTS)],
          ],
        },
        note: "The $300 Newsletter Module value is shown for reference and has been credited in full because that module was previously paid for. The remaining work is included in the schedule at no additional charge.",
      },
      {
        heading: "Project Schedule",
        body: [
          "Due to previously scheduled client commitments, development is anticipated to begin between August 24 and August 30, 2026, assuming acceptance of this proposal and completion of the required project-start requirements.",
          "The project is estimated to require 24–36 business days from kickoff, assuming requirements are approved before development begins, feedback and approvals are provided within 2–3 business days, requested changes remain within the agreed scope, and third-party services are available and functioning as expected.",
        ],
        table: {
          columns: ["Project Phase", "Estimated Duration"],
          rows: BFW_LINE_ITEMS.map((item) => [item.label, item.durationLabel ?? "—"]),
        },
      },
      {
        heading: "Items Excluded",
        body: ["The following items are not included in this proposal:"],
        bullets: [
          "B2B Membership Portal",
          "Payment processing",
          "Multi-user authentication",
          "Company management",
          "Employee management",
          "Protected member content",
          "Subscription billing",
        ],
        note: "These features are addressed separately in Proposal #2 – B2B Membership Portal.",
      },
    ],
    acceptance: {
      intro: [
        "This proposal represents the agreed scope of work for the Build Financial Wellness Website Enhancement Project.",
        "Acceptance of this proposal authorizes BLEXware to begin work according to the scope, schedule, and payment terms described herein.",
      ],
      signerName: BFW_CLIENT.name,
    },
  };
}
