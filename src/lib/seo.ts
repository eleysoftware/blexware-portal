export const SITE_URL = "https://blexware.com";

/** Self-referencing canonical + og:url for a public page. */
export function pageSeo(path: string) {
  const url = `${SITE_URL}${path === "/" ? "" : path}` || SITE_URL;
  return {
    meta: [
      { property: "og:url", content: url },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    type: "application/ld+json",
    children: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: it.name,
        item: `${SITE_URL}${it.path === "/" ? "" : it.path}`,
      })),
    }),
  };
}

export const organizationLd = {
  type: "application/ld+json",
  children: JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "BLEXware",
        url: SITE_URL,
        logo: `${SITE_URL}/favicon.png`,
        description:
          "Custom websites, web applications, mobile apps, and AI automation for growing businesses.",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "BLEXware",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ],
  }),
};
