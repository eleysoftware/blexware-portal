export type Service = {
  slug: string;
  name: string;
  summary: string;
  details: string[];
  icon:
    | "monitor"
    | "layout-dashboard"
    | "smartphone"
    | "sparkles"
    | "workflow"
    | "users"
    | "wrench"
    | "cloud"
    | "plug";
};

export const services: Service[] = [
  {
    slug: "websites",
    name: "Websites",
    summary:
      "Marketing sites engineered for speed, search, and conversion — not templates with your logo dropped in.",
    details: ["Custom design systems", "Server-rendered performance", "SEO and structured data", "Accessible by default"],
    icon: "monitor",
  },
  {
    slug: "web-applications",
    name: "Web Applications",
    summary: "Portals, dashboards, and internal tools that replace the spreadsheet holding your business together.",
    details: ["Role-based access control", "Reporting and dashboards", "Document handling", "Audit trails"],
    icon: "layout-dashboard",
  },
  {
    slug: "mobile-apps",
    name: "Mobile Apps",
    summary: "Cross-platform apps that share a codebase with your web product so features ship once.",
    details: ["iOS and Android", "Offline-tolerant data", "Push notifications", "App store delivery"],
    icon: "smartphone",
  },
  {
    slug: "ai-solutions",
    name: "AI Solutions",
    summary: "Practical AI features tied to a business outcome, with humans reviewing anything that leaves the building.",
    details: ["Document understanding", "Drafting and summarization", "Provider abstraction and fallback", "Prompt versioning"],
    icon: "sparkles",
  },
  {
    slug: "automation",
    name: "Automation",
    summary: "Remove the repetitive work between your systems, your inbox, and your team.",
    details: ["Workflow orchestration", "Notification pipelines", "Data sync between tools", "Scheduled jobs"],
    icon: "workflow",
  },
  {
    slug: "consulting",
    name: "Consulting",
    summary: "Architecture reviews, technology selection, and roadmaps for teams deciding what to build next.",
    details: ["Discovery workshops", "Technical due diligence", "Roadmapping", "Build vs. buy analysis"],
    icon: "users",
  },
  {
    slug: "maintenance",
    name: "Maintenance",
    summary: "Ongoing support, monitoring, and improvement so software keeps earning after launch.",
    details: ["Uptime and error monitoring", "Dependency and security updates", "Performance budgets", "Iterative improvements"],
    icon: "wrench",
  },
  {
    slug: "cloud-migration",
    name: "Cloud Migration",
    summary: "Move legacy systems to managed infrastructure without a risky big-bang cutover.",
    details: ["Migration planning", "Data migration and validation", "Zero-downtime cutover", "Cost optimization"],
    icon: "cloud",
  },
  {
    slug: "custom-apis",
    name: "Custom APIs",
    summary: "Documented, versioned integration layers that let your systems and partners talk to each other.",
    details: ["REST and webhook design", "Authentication and rate limiting", "Versioning strategy", "Developer documentation"],
    icon: "plug",
  },
];

export const featuredServices = [
  "Website Design",
  "Web Applications",
  "Mobile Apps",
  "AI Integration",
  "Automation",
  "Custom Software",
  "API Development",
  "Maintenance",
];

export const processSteps = [
  { name: "Discovery", description: "We learn the business before we touch a design tool." },
  { name: "Planning", description: "Scope, architecture, timeline, and budget written down." },
  { name: "Design", description: "A visual system built for your audience, not a template." },
  { name: "Development", description: "Production code, reviewed and shipped in increments." },
  { name: "Testing", description: "Functional, security, accessibility, and performance checks." },
  { name: "Launch", description: "Deployment, monitoring, analytics, and handover." },
  { name: "Support", description: "Ongoing improvement backed by a real maintenance plan." },
];
