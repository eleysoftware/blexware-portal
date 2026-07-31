import articleAi from "@/assets/article-ai-proposals.jpg";
import articleSecure from "@/assets/article-secure-uploads.jpg";
import articleMvp from "@/assets/article-mvp.jpg";

export type Article = {
  slug: string;
  title: string;
  summary: string;
  image: string;
  imageAlt: string;
  author: string;
  publishedDate: string;
  readTime: string;
  categories: string[];
  tags: string[];
  body: { heading?: string; paragraphs: string[] }[];
};

export const articles: Article[] = [
  {
    slug: "ai-proposals-still-need-a-human",
    title: "AI Can Draft Your Proposal. It Should Never Send It.",
    summary:
      "Generative AI is excellent at structure and terrible at accountability. Here is the review workflow we build into every AI feature we ship.",
    image: articleAi,
    imageAlt: "Abstract illustration of an AI-drafted document being reviewed",
    author: "BLEXware Team",
    publishedDate: "2026-06-18",
    readTime: "6 min read",
    categories: ["AI"],
    tags: ["AI governance", "Proposals", "Workflow"],
    body: [
      {
        paragraphs: [
          "A language model can produce a well-organized software proposal in seconds. What it cannot do is take responsibility for the number at the bottom of the page. That distinction drives every AI feature we build.",
        ],
      },
      {
        heading: "Generation is a button, not a trigger",
        paragraphs: [
          "In our workflow, nothing is generated automatically when a form is submitted. An administrator opens the quote, reviews what the prospect actually asked for, and clicks generate. That single design decision prevents the most common AI failure mode: a confident document reaching a client that nobody read.",
          "The prompt used for each generation is stored alongside the output. When a proposal is wrong, you can see exactly what the model was told.",
        ],
      },
      {
        heading: "Disclose, then review",
        paragraphs: [
          "Clients are told plainly that drafts are AI-assisted and human-reviewed. In our experience this increases trust rather than reducing it — because the alternative, discovering it later, does real damage.",
        ],
      },
      {
        heading: "Fallbacks matter",
        paragraphs: [
          "Model providers have outages. We abstract the provider behind a single interface so a failure means switching vendors, not halting sales.",
        ],
      },
    ],
  },
  {
    slug: "handling-sensitive-uploads",
    title: "What Happens to a PDF After Someone Uploads It",
    summary:
      "Tax returns, financial statements, and property documents arrive through ordinary web forms. Here is the pipeline that should sit behind that upload button.",
    image: articleSecure,
    imageAlt: "Abstract illustration of a secure document pipeline",
    author: "BLEXware Team",
    publishedDate: "2026-05-02",
    readTime: "7 min read",
    categories: ["Security"],
    tags: ["File uploads", "Security", "Compliance"],
    body: [
      {
        paragraphs: [
          "If your quote form accepts documents from lenders, investors, or medical practices, that upload button is the most sensitive part of your website. Treat it accordingly.",
        ],
      },
      {
        heading: "Validate twice",
        paragraphs: [
          "Client-side checks improve the experience: reject the wrong file type and oversized files before a slow upload starts. They are not security. Every check runs again on the server, where the user cannot intervene.",
          "Server-side validation covers MIME type, extension, size limits, malware scanning, embedded JavaScript, password protection, and file corruption.",
        ],
      },
      {
        heading: "Never email the file",
        paragraphs: [
          "Sensitive documents belong in access-controlled storage, delivered through short-lived signed URLs, with every download logged. Email attachments defeat all three properties at once.",
        ],
      },
      {
        heading: "Delete on a schedule",
        paragraphs: [
          "Retention is a security control. Files you no longer hold cannot be leaked, so define a deletion schedule and automate it rather than leaving it to good intentions.",
        ],
      },
    ],
  },
  {
    slug: "mvp-that-survives-launch",
    title: "Building an MVP That Survives Its First Hundred Customers",
    summary:
      "Most prototypes get rewritten within a year. A small number of early decisions determine which category yours lands in.",
    image: articleMvp,
    imageAlt: "Abstract illustration of a software architecture growing in stages",
    author: "BLEXware Team",
    publishedDate: "2026-03-21",
    readTime: "5 min read",
    categories: ["Engineering"],
    tags: ["MVP", "Architecture", "Startups"],
    body: [
      {
        paragraphs: [
          "Minimum viable does not mean disposable. The goal is the smallest product that can grow, not the smallest product that can demo.",
        ],
      },
      {
        heading: "Get the data model right early",
        paragraphs: [
          "Interfaces are cheap to change. Data models are not. Spending an extra week on entities, relationships, and access rules routinely saves a quarter of rework later.",
        ],
      },
      {
        heading: "Real authentication from day one",
        paragraphs: [
          "Bolting authentication and row-level authorization onto a finished product is a rewrite. Building on them from the first commit is a Tuesday.",
        ],
      },
      {
        heading: "Ship increments, not milestones",
        paragraphs: [
          "Deploy continuously and put working software in front of users weekly. Feedback that arrives before launch is worth ten times the same feedback afterward.",
        ],
      },
    ],
  },
];

export const getArticle = (slug: string) => articles.find((article) => article.slug === slug);

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
