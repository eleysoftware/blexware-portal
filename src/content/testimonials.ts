export type Testimonial = {
  id: string;
  clientName: string;
  company: string;
  initials: string;
  rating: number;
  review: string;
};

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    clientName: "Marcus Ellery",
    company: "Build Financial Wellness",
    initials: "ME",
    rating: 5,
    review:
      "BLEXware understood the compliance side of financial content without us having to explain it twice. The intake flow alone changed the quality of the conversations we have with new clients.",
  },
  {
    id: "t2",
    clientName: "Dana Whitfield",
    company: "KYC Investments",
    initials: "DW",
    rating: 5,
    review:
      "We stopped emailing sensitive documents the week we launched. Secure links, access logs, and a platform our partners trust — exactly what we asked for.",
  },
  {
    id: "t3",
    clientName: "Terrence Boyd",
    company: "SportE Golf",
    initials: "TB",
    rating: 5,
    review:
      "Running a tournament used to take three people and six spreadsheets. Now it takes one dashboard. They clearly built this with people who have actually run events.",
  },
  {
    id: "t4",
    clientName: "Alicia Reyes",
    company: "Reyes Property Group",
    initials: "AR",
    rating: 5,
    review:
      "They pushed back on features we did not need and shipped the ones that made us money. That is rare and worth paying for.",
  },
];
