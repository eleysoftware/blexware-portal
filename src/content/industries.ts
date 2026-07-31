export type IndustryGroupId =
  | "business"
  | "real-estate"
  | "sports"
  | "entertainment"
  | "healthcare"
  | "education"
  | "nonprofit"
  | "technology";

export type Industry = {
  slug: string;
  name: string;
  group: IndustryGroupId;
  tagline: string;
  copy: string;
  benefits: string[];
  portfolio: string[];
};

export type IndustryGroup = {
  id: IndustryGroupId;
  label: string;
  headline: string;
  intro: string;
};

export const industryGroups: IndustryGroup[] = [
  {
    id: "business",
    label: "Business",
    headline: "Software that turns expertise into recurring revenue",
    intro:
      "Consultants, coaches, speakers, and professional services firms win on credibility. We build the platforms that make that credibility obvious before the first call.",
  },
  {
    id: "real-estate",
    label: "Real Estate",
    headline: "Deal flow, underwriting, and investor trust in one platform",
    intro:
      "Agents, investors, lenders, brokers, and builders run on documents and deadlines. We automate the paperwork and give your capital partners a portal worth logging into.",
  },
  {
    id: "sports",
    label: "Sports",
    headline: "Tournament operations without the spreadsheets",
    intro:
      "Registration, scoring, scheduling, and sponsor visibility — purpose-built for organizations that run real events, not demos.",
  },
  {
    id: "entertainment",
    label: "Entertainment",
    headline: "Your audience, your data, your platform",
    intro:
      "Artists, athletes, and influencers should own the relationship with their audience instead of renting it from an algorithm.",
  },
  {
    id: "healthcare",
    label: "Healthcare",
    headline: "Patient-facing software built with privacy first",
    intro:
      "Practices need intake, scheduling, and communication that respect sensitive data from the first line of code.",
  },
  {
    id: "education",
    label: "Education",
    headline: "Learning experiences people actually finish",
    intro:
      "Course platforms, member portals, and cohort tooling for people who teach for a living.",
  },
  {
    id: "nonprofit",
    label: "Nonprofit",
    headline: "More time on mission, less on admin",
    intro:
      "Churches and nonprofits get donor management, events, and communications in one accessible, low-maintenance system.",
  },
  {
    id: "technology",
    label: "Technology",
    headline: "From idea to a product investors can try",
    intro:
      "Startups and technical founders get an engineering partner who ships production software, not throwaway prototypes.",
  },
];

export const industries: Industry[] = [
  {
    slug: "business-consultants",
    name: "Business Consultants",
    group: "business",
    tagline: "Turn your methodology into a productized digital offer.",
    copy: "Prospects judge a consultancy by its website in under ten seconds. We build authority sites with intake, scheduling, proposal automation, and client portals so your practice looks and operates like a firm three times its size.",
    benefits: [
      "Qualified-lead intake that filters out tire kickers",
      "Automated proposals and engagement letters",
      "Client portals for deliverables and progress",
    ],
    portfolio: ["build-financial-wellness"],
  },
  {
    slug: "financial-consultants",
    name: "Financial Consultants",
    group: "business",
    tagline: "Credibility-first platforms for money professionals.",
    copy: "Financial audiences are skeptical by default. We design calm, precise experiences with the disclosures, secure document handling, and compliance-aware messaging your industry demands.",
    benefits: [
      "Secure document exchange with signed links",
      "Compliance-aware content workflows",
      "Calculators and planning tools that generate leads",
    ],
    portfolio: ["build-financial-wellness", "kyc-investments"],
  },
  {
    slug: "coaches",
    name: "Coaches",
    group: "business",
    tagline: "Sell programs, not hours.",
    copy: "We build cohort and one-to-one coaching platforms with applications, scheduling, payments, and progress tracking so your program scales past your calendar.",
    benefits: [
      "Application funnels that pre-qualify clients",
      "Session scheduling and reminders",
      "Progress dashboards clients look forward to",
    ],
    portfolio: [],
  },
  {
    slug: "speakers",
    name: "Speakers",
    group: "business",
    tagline: "A booking experience event organizers trust.",
    copy: "Speaker kits, reel galleries, topic pages, and a booking pipeline that captures event details up front — so your inbox holds real inquiries instead of vague emails.",
    benefits: ["Structured booking inquiries", "Media kit and reel library", "Topic and testimonial pages"],
    portfolio: [],
  },
  {
    slug: "real-estate-agents",
    name: "Real Estate Agents",
    group: "real-estate",
    tagline: "Listings, leads, and follow-up on autopilot.",
    copy: "IDX-ready listing experiences, neighborhood pages that rank, and automated follow-up that keeps you in front of buyers between transactions.",
    benefits: ["Fast, SEO-strong listing pages", "Automated lead nurture", "Neighborhood content that ranks locally"],
    portfolio: [],
  },
  {
    slug: "real-estate-investors",
    name: "Real Estate Investors",
    group: "real-estate",
    tagline: "Underwrite faster, raise capital cleaner.",
    copy: "Deal pipelines, underwriting calculators, and investor portals with document rooms, distributions, and reporting — all with access logging on sensitive files.",
    benefits: ["Deal pipeline and underwriting tools", "Investor portal with secure document rooms", "Automated reporting"],
    portfolio: ["kyc-investments"],
  },
  {
    slug: "hard-money-lenders",
    name: "Hard Money Lenders",
    group: "real-estate",
    tagline: "Applications in, decisions out, nothing lost.",
    copy: "Loan application intake, document collection, scenario pricing, and borrower status tracking — with strict handling for financial statements and tax documents.",
    benefits: ["Structured loan intake", "Secure financial document handling", "Borrower status transparency"],
    portfolio: [],
  },
  {
    slug: "mortgage-brokers",
    name: "Mortgage Brokers",
    group: "real-estate",
    tagline: "Pre-qualification that starts before the phone call.",
    copy: "Rate tools, pre-qualification flows, and referral-partner portals that make you the easiest broker in the market to work with.",
    benefits: ["Pre-qualification flows", "Referral partner portals", "Automated milestone updates"],
    portfolio: [],
  },
  {
    slug: "construction-companies",
    name: "Construction Companies",
    group: "real-estate",
    tagline: "Bids, jobs, and clients in one system.",
    copy: "Project galleries that win bids, estimate request flows, and job tracking your crews will actually use on a phone in the field.",
    benefits: ["Estimate request intake", "Field-friendly job tracking", "Portfolio galleries that close bids"],
    portfolio: [],
  },
  {
    slug: "home-service-businesses",
    name: "Home Service Businesses",
    group: "real-estate",
    tagline: "Book more jobs from the same traffic.",
    copy: "Local SEO, instant quote flows, online booking, and review generation that compounds month over month.",
    benefits: ["Instant quote and booking", "Local SEO built in", "Automated review requests"],
    portfolio: [],
  },
  {
    slug: "attorneys",
    name: "Attorneys",
    group: "business",
    tagline: "Intake that respects confidentiality.",
    copy: "Practice-area sites with conflict-aware intake, secure client document exchange, and matter status portals.",
    benefits: ["Confidential intake forms", "Secure document exchange", "Matter status portals"],
    portfolio: [],
  },
  {
    slug: "medical-practices",
    name: "Medical Practices",
    group: "healthcare",
    tagline: "Patient experience from first search to follow-up.",
    copy: "Provider directories, appointment requests, digital intake, and patient communications designed with privacy and accessibility as requirements, not afterthoughts.",
    benefits: ["Digital intake and appointment requests", "Accessible, WCAG-conscious design", "Privacy-first data handling"],
    portfolio: [],
  },
  {
    slug: "restaurants",
    name: "Restaurants",
    group: "business",
    tagline: "Own your orders and your customer list.",
    copy: "Menus that update in seconds, reservations, catering inquiries, and loyalty — without handing your margin to a marketplace.",
    benefits: ["Self-managed menus", "Reservations and catering inquiries", "First-party customer data"],
    portfolio: [],
  },
  {
    slug: "sporting-organizations",
    name: "Sporting Organizations",
    group: "sports",
    tagline: "Run leagues and events like a pro operation.",
    copy: "Registration, rosters, scheduling, standings, and sponsor placements in one platform your volunteers can operate.",
    benefits: ["Online registration and payments", "Scheduling and standings", "Sponsor visibility"],
    portfolio: ["sporte-golf"],
  },
  {
    slug: "tournament-directors",
    name: "Tournament Directors",
    group: "sports",
    tagline: "One dashboard for the whole event.",
    copy: "Flights, pairings, live scoring, and results publishing — built from real tournament operations, not a generic events template.",
    benefits: ["Flight and pairing management", "Live scoring", "Instant results publishing"],
    portfolio: ["sporte-golf"],
  },
  {
    slug: "golf-courses",
    name: "Golf Courses",
    group: "sports",
    tagline: "Fill tee sheets and event calendars.",
    copy: "Tee time and outing inquiries, membership content, and tournament hosting pages that convert corporate organizers.",
    benefits: ["Outing and tee time inquiries", "Membership content", "Tournament hosting pages"],
    portfolio: ["sporte-golf"],
  },
  {
    slug: "musicians",
    name: "Musicians",
    group: "entertainment",
    tagline: "Tour dates, releases, and merch under your name.",
    copy: "Release pages, tour calendars, mailing list capture, and merch — a home base that outlives any single platform.",
    benefits: ["Release and tour pages", "Mailing list ownership", "Merch and ticketing links"],
    portfolio: [],
  },
  {
    slug: "djs",
    name: "DJs",
    group: "entertainment",
    tagline: "Bookings without the DM back-and-forth.",
    copy: "Mix libraries, event calendars, and structured booking requests that capture date, venue, and budget up front.",
    benefits: ["Structured booking requests", "Mix and set libraries", "Event calendar"],
    portfolio: [],
  },
  {
    slug: "singers",
    name: "Singers",
    group: "entertainment",
    tagline: "A press-ready presence.",
    copy: "EPKs, video galleries, press coverage, and booking flows that make you easy for promoters to say yes to.",
    benefits: ["Electronic press kit", "Video and photo galleries", "Booking inquiries"],
    portfolio: [],
  },
  {
    slug: "actors",
    name: "Actors",
    group: "entertainment",
    tagline: "Reels and credits, always current.",
    copy: "Casting-friendly profiles with reels, resumes, headshot galleries, and representation details in one link.",
    benefits: ["Reel and resume hosting", "Headshot galleries", "Representation contact"],
    portfolio: [],
  },
  {
    slug: "athletes",
    name: "Athletes",
    group: "entertainment",
    tagline: "Build the brand behind the stats.",
    copy: "Career highlights, NIL and sponsorship pages, camps and appearances, and audience capture you control.",
    benefits: ["NIL and sponsorship pages", "Highlight and stat showcases", "Camp and appearance booking"],
    portfolio: [],
  },
  {
    slug: "social-media-influencers",
    name: "Social Media Influencers",
    group: "entertainment",
    tagline: "Convert followers into a business.",
    copy: "Media kits with live audience data, brand partnership inquiry flows, digital products, and an email list nobody can take from you.",
    benefits: ["Live media kit", "Brand partnership inquiries", "Digital product storefront"],
    portfolio: [],
  },
  {
    slug: "churches",
    name: "Churches",
    group: "nonprofit",
    tagline: "Connect your congregation all week.",
    copy: "Sermon libraries, events, small group signups, and online giving in a site your team can update without a developer.",
    benefits: ["Sermon and media library", "Events and group signups", "Online giving"],
    portfolio: [],
  },
  {
    slug: "nonprofits",
    name: "Nonprofits",
    group: "nonprofit",
    tagline: "Tell the story, prove the impact.",
    copy: "Donation flows, impact reporting, volunteer management, and grant-ready reporting built for small teams.",
    benefits: ["Donation and recurring giving", "Impact reporting", "Volunteer management"],
    portfolio: [],
  },
  {
    slug: "startups",
    name: "Startups",
    group: "technology",
    tagline: "Ship an MVP investors can log into.",
    copy: "We build production MVPs with real authentication, real data, and an architecture that survives your first hundred customers.",
    benefits: ["Production-grade MVP", "Architecture that scales past launch", "AI features that are actually useful"],
    portfolio: ["kyc-investments", "sporte-golf"],
  },
];

export const industriesByGroup = (group: IndustryGroupId) =>
  industries.filter((industry) => industry.group === group);
