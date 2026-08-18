import {
  formatMoney,
  type EstimateLineItem,
  type PaymentPlan,
  type ProjectDocument,
} from "@/lib/documents/types";
import { buildPaymentPlan } from "@/lib/documents/compose";

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

export const BFW_PREPARED_BY = {
  name: "Kam Eley",
  company: "BLEXware",
  phone: "(260) 433-8734",
  email: "eleysoftware@gmail.com",
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
    note: "$0 – Previously Paid",
    durationLabel: "5–7 days",
  },
  { label: "Phase 5 – Financial Tools Library", amountCents: 25000, durationLabel: "5–7 days" },
  { label: "Phase 6 – Contact Section Enhancements", amountCents: 12500, durationLabel: "4–6 days" },
  { label: "Phase 7 – Website Administration", amountCents: 32500, durationLabel: "5–7 days" },
];

export const BFW_SUBTOTAL_CENTS = 130000;
export const BFW_DISCOUNT_CENTS = 26000;
export const BFW_TOTAL_CENTS = 104000;
export const BFW_DOCUMENT_TITLE = "Website Enhancement Proposal";
export const BFW_PAYMENT_PLAN: PaymentPlan = buildPaymentPlan("fifty_fifty", BFW_TOTAL_CENTS);

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

function phase(
  heading: string,
  objective: string,
  features: Omit<ProjectDocument["sections"][number], "heading" | "level">,
): ProjectDocument["sections"][number] {
  return {
    heading,
    level: 2,
    children: [
      { heading: "Objective", level: 3, body: [objective] },
      { heading: "Features Included", level: 3, ...features },
    ],
  };
}

export function buildBfwProposalDoc(): ProjectDocument {
  return {
    kind: "proposal",
    title: "BUILD FINANCIAL WELLNESS",
    subtitle: "Website Enhancement Proposal & Project Estimate",
    documentTitle: BFW_DOCUMENT_TITLE,
    projectLabel: "Website Enhancement Project",
    clientName: BFW_CLIENT.company,
    date: "August 2026",
    preparedFor: BFW_CLIENT,
    preparedBy: BFW_PREPARED_BY,
    paymentPlan: BFW_PAYMENT_PLAN,
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
        heading: "Scope of Work",
        children: [
          phase(
            "Phase 1 – Navigation Enhancements",
            "Improve website navigation to better reflect the evolving structure and functionality of the Build Financial Wellness website.",
            {
              bullets: [
                "Rename Support to Resources",
                "Rename the Resources submenu to Resource Library",
                "Replace the Book a Free Consultation navigation CTA with Client Login",
                "Update NuvolaSoft branding to BLEXware",
                "Update associated routing and navigation logic",
              ],
            },
          ),
          {
            heading: "Phase 2 – Services Section Redesign",
            level: 2,
            children: [
              {
                heading: "Objective",
                level: 3,
                body: [
                  "Update the Services section to better reflect Build Financial Wellness' current services and coaching platform.",
                ],
              },
              {
                heading: "Features Included",
                level: 3,
                groups: [
                  { heading: "Remove", bullets: ["Build Journey", "Budget Build", "Budget Mixer"] },
                  {
                    heading: "Replace With",
                    bullets: ["Individuals / Households", "Employees / Organizations"],
                  },
                  {
                    heading: "Additional Updates",
                    bullets: ["Update CTA links", "Replace Acuity scheduling with Simply Coach"],
                  },
                ],
              },
            ],
          },
          phase(
            "Homepage Hero Section Optimization",
            "Improve visitor understanding and engagement by clearly communicating what the Financial Check-In is and what visitors can expect when they take the first step.",
            {
              bullets: [
                'Replace the existing "Get Started" button with: Get Your Free Financial Check-In',
                'Add the following supporting text: "Receive your free five-minute Financial Check-In to help you reflect, gain clarity, and discover your next financial step."',
                "Implement the updated messaging while maintaining the existing clean design and visual balance of the Hero section.",
                "Adjust spacing, layout, or supporting elements as necessary to accommodate the revised call-to-action and supporting message.",
              ],
              body: [
                "The final implementation will be designed to clearly communicate the purpose of the Financial Check-In without unnecessarily increasing visual clutter or compromising the existing Hero-section design.",
              ],
            },
          ),
          phase(
            "Phase 3 – Resource Center Redesign",
            "Redesign the existing Resources page to support two primary resource types while maintaining the clean, professional appearance of the current website.",
            {
              bullets: [
                "New Resources landing page",
                "Tab navigation: Tools | Newsletters",
                "Tools tab displayed as the default view",
                "Fully responsive layout",
                "Pagination for Newsletters",
                "Resource thumbnails",
                "Individual resource detail pages",
                "Updated navigation",
              ],
            },
          ),
          {
            heading: "Phase 4 – Newsletter Module",
            level: 2,
            children: [
              {
                heading: "Objective",
                level: 3,
                body: ["Replace the original Blog concept with a dedicated Newsletter system."],
              },
              {
                heading: "Features Included",
                level: 3,
                groups: [
                  {
                    heading: "Public Features",
                    bullets: [
                      "Newsletter listing",
                      "Pagination",
                      "Thumbnail images",
                      "Newsletter detail page",
                    ],
                  },
                  {
                    heading: "Administrative Features",
                    bullets: [
                      "Create newsletters",
                      "Edit newsletters",
                      "Delete newsletters",
                      "Publish / unpublish newsletters",
                    ],
                  },
                ],
              },
              {
                heading: "Previously Paid — Work Remaining",
                callout: "success",
                body: [
                  "The Newsletter Module was previously paid for under an earlier project agreement. It is included in this proposal to document the complete enhancement scope and will not result in an additional charge. The remaining development work for this module is estimated and scheduled as part of this project.",
                ],
                note: "Original Estimated Value: $300    |    Additional Cost: $0    |    Estimated Duration: 5–7 days",
              },
            ],
          },
          phase(
            "Phase 5 – Financial Tools Library",
            "Provide downloadable financial resources through an organized and user-friendly resource library.",
            {
              bullets: [
                "Four downloadable financial tools",
                "Download confirmation workflow",
                "Download management",
                "Administrative upload capability",
              ],
              note: "The downloadable financial tools will not be used as lead generators. The previously proposed lead-capture functionality has therefore been removed from this phase.",
            },
          ),
          phase(
            "Phase 6 – Contact Section Enhancements",
            "Improve the website's Contact section while supporting the distribution of the Savings Reset Kit.",
            {
              bullets: [
                "Replace the newsletter download with the Savings Reset Kit",
                "Make First Name optional",
                "Remove Last Name",
                "Require Email Address",
                "Provide an administrator-managed downloadable PDF",
                "Update the business phone number from the existing toll-free number to the new local phone number",
              ],
            },
          ),
          phase(
            "Phase 7 – Website Administration",
            "Provide a secure administrative area allowing ongoing management of website content and downloadable resources.",
            {
              bullets: [
                "Newsletter management",
                "Financial Tools management",
                "Downloadable PDF management",
                "Hidden administrator login",
              ],
            },
          ),
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
            ["Phase 1 – Navigation Enhancements", formatMoney(10000)],
            ["Phase 2 – Services Section Redesign & Hero Optimization", formatMoney(15000)],
            ["Phase 3 – Resource Center Redesign", formatMoney(35000)],
            ["Phase 4 – Newsletter Module  $0 – Previously Paid", formatMoney(30000)],
            ["Phase 5 – Financial Tools Library", formatMoney(25000)],
            ["Phase 6 – Contact Section Enhancements", formatMoney(12500)],
            ["Phase 7 – Website Administration", formatMoney(32500)],
            ["Project Subtotal", formatMoney(BFW_SUBTOTAL_CENTS)],
            ["Preferred Client Loyalty Discount (20%)", `–${formatMoney(BFW_DISCOUNT_CENTS)}`],
            ["Total Project Investment", formatMoney(BFW_TOTAL_CENTS)],
          ],
          rowTones: [
            "default",
            "default",
            "default",
            "default",
            "default",
            "default",
            "default",
            "muted",
            "discount",
            "total",
          ],
        },
        note: "The $300 Newsletter Module value is shown for reference and has been credited in full because that module was previously paid for. The remaining work is included in the schedule at no additional charge.",
      },
      {
        heading: "Project Schedule",
        children: [
          {
            heading: "Project Availability",
            level: 3,
            body: [
              "Due to previously scheduled client commitments, development is anticipated to begin between August 24 and August 30, 2026, assuming acceptance of this proposal and completion of the required project-start requirements.",
            ],
          },
          {
            heading: "Estimated Project Duration",
            level: 3,
            body: [
              "The project is estimated to require 24–40 business days from project kickoff, assuming:",
            ],
            bullets: [
              "Requirements are approved before development begins.",
              "Feedback and approvals are provided within 2–3 business days.",
              "Requested changes remain within the agreed project scope.",
              "Third-party services, including Simply Coach and other required integrations, are available and functioning as expected.",
            ],
          },
          {
            heading: "Estimated Timeline by Phase",
            level: 3,
            table: {
              columns: ["Project Phase", "Estimated Duration"],
              rows: [
                ["Navigation Enhancements", "2–3 days"],
                ["Services Section Redesign & Hero Optimization", "2–3 days"],
                ["Resource Center Redesign", "5–7 days"],
                ["Newsletter Module", "5–7 days"],
                ["Financial Tools Library", "5–7 days"],
                ["Contact Section Enhancements", "4–6 days"],
                ["Website Administration", "5–7 days"],
              ],
            },
            note: "Estimated Total Project Duration: 24–36 business days",
          },
        ],
      },
      {
        heading: "Payment Terms",
        body: [
          "The project investment will be paid according to the following schedule:",
          "The final payment is due upon completion of the approved project scope and prior to final deployment of the completed enhancements.",
          "Any work requested outside the approved scope of this proposal may require a separate estimate and written approval before implementation.",
        ],
        table: {
          columns: ["", "Amount"],
          numeric: true,
          rows: [
            ["50% Upon Proposal Acceptance", formatMoney(52000)],
            ["50% Upon Project Completion", formatMoney(52000)],
          ],
          rowTones: ["fill", "fill"],
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
