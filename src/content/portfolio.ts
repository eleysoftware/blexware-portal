import bfwImage from "@/assets/portfolio-bfw.jpg";
import kycImage from "@/assets/portfolio-kyc.jpg";
import sporteImage from "@/assets/portfolio-sporte.jpg";

export type PortfolioProject = {
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string;
  image: string;
  imageAlt: string;
  technologies: string[];
  features: string[];
  screenshots: { caption: string }[];
  url?: string;
  featured: boolean;
};

export const portfolio: PortfolioProject[] = [
  {
    slug: "build-financial-wellness",
    name: "Build Financial Wellness",
    category: "Financial Consulting",
    summary: "A financial consulting practice turned into a credible, lead-generating digital front door.",
    description:
      "Build Financial Wellness needed a presence that matched the seriousness of the advice it gives. We designed an authority-first site with structured service pages, an education library, and a consultation intake flow that captures the context an advisor needs before the first meeting.",
    image: bfwImage,
    imageAlt: "Build Financial Wellness website shown on a laptop with financial planning dashboards",
    technologies: ["React", "TypeScript", "Tailwind CSS", "PostgreSQL", "Server-side rendering"],
    features: [
      "Service and program pages built for organic search",
      "Consultation intake that qualifies leads before the call",
      "Education library with categories and related content",
      "Accessible, mobile-first layouts throughout",
    ],
    screenshots: [
      { caption: "Homepage with program overview" },
      { caption: "Consultation intake flow" },
      { caption: "Education library" },
    ],
    featured: true,
  },
  {
    slug: "blex-investments",
    name: "BLEX Investments",
    category: "Investment Firm",
    summary: "An investment firm platform spanning private credit, private equity, and real assets.",
    description:
      "BLEX Investments invests across private credit, private equity, and real assets. The platform presents each strategy clearly to prospective partners while handling sensitive documents through secure, access-logged delivery rather than email attachments.",
    image: kycImage,
    imageAlt: "BLEX Investments platform interface showing investment strategy pages and portfolio data",
    technologies: ["React", "TypeScript", "Tailwind CSS", "PostgreSQL", "Secure file storage"],
    features: [
      "Strategy pages for private credit, equity, and real assets",
      "Secure document delivery with signed, expiring links",
      "Investor inquiry workflow with routing",
      "Content model ready for ongoing strategy updates",
    ],
    screenshots: [
      { caption: "Strategy overview" },
      { caption: "Secure document room" },
      { caption: "Investor inquiry flow" },
    ],
    featured: true,
  },
  {
    slug: "sporte-golf",
    name: "SportE Golf",
    category: "Sports Technology",
    summary: "A golf tournament platform in the SportE product family, built for real event operations.",
    description:
      "SportE Golf is the golf tournament platform within the SportE family of sports products. It handles registration, flights and pairings, live scoring, and results publishing so directors can run an event from one dashboard instead of a stack of spreadsheets.",
    image: sporteImage,
    imageAlt: "SportE Golf tournament platform showing live scoring and pairings on a laptop and phone",
    technologies: ["React", "TypeScript", "Tailwind CSS", "PostgreSQL", "Realtime updates"],
    features: [
      "Player registration and payment collection",
      "Flight, pairing, and tee sheet management",
      "Live scoring with instant leaderboard updates",
      "Sponsor placement and results publishing",
    ],
    screenshots: [
      { caption: "Tournament dashboard" },
      { caption: "Live leaderboard" },
      { caption: "Pairings and tee sheet" },
    ],
    featured: true,
  },
];

export const getProject = (slug: string) => portfolio.find((project) => project.slug === slug);
