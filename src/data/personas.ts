export type Persona = {
  slug: string;
  name: string;
  role: string;
  age: number;
  avatar: string;
  headline: string;
  personalityTags: string[];
  quote: string;
  basics: {
    location: string;
    income: string;
    education: string;
    devices: string;
  };
  brandValues: string[];
  digitalBehavior: string[];
  goals: string[];
  painPoints: string[];
  preferredPlatforms: string[];
  funnelStageEmphasis: {
    awareness: number;
    consideration: number;
    conversion: number;
    loyalty: number;
  };
  contentFormats: { label: string; value: number }[];
};

export const personas: Persona[] = [
  {
    slug: "hannah-morales",
    name: "Hannah Morales",
    role: "Wellness Coach & Micro-Influencer",
    age: 31,
    avatar: "/personas/hannah-morales.jpg",
    headline: "Mindful wellness creator prioritizing meaningful engagement over vanity metrics.",
    personalityTags: ["Mindful", "Consistent", "Empathetic"],
    quote: "If I can't genuinely help my community, the numbers don't matter.",
    basics: {
      location: "Austin, TX",
      income: "$85K from coaching + partnerships",
      education: "B.S. Kinesiology, ACE Certified",
      devices: "MacBook Air, iPad Mini, iPhone 15 Pro",
    },
    brandValues: ["Transparency", "Community", "Balance"],
    digitalBehavior: [
      "Publishes 2 long-form YouTube videos per month documenting client journeys",
      "Hosts weekly Instagram Live breathwork sessions with 300+ average attendees",
      "Schedules automated nurture emails after every download of her habit tracker",
      "Replies to 90% of DMs within 24 hours to maintain trust",
    ],
    goals: [
      "Grow her paid group program without losing the intimate community feel",
      "Surface which brand collaborations actually drive sign-ups for retreats",
      "Understand when followers are ready to invest in higher-ticket coaching",
    ],
    painPoints: [
      "Platform analytics feel noisy and don't map to her funnel stages",
      "Manual tracking of DMs, waitlist tags, and purchases eats into coaching time",
      "Hard to prove value to wellness brands that focus on reach over resonance",
    ],
    preferredPlatforms: ["Instagram", "YouTube", "Circle", "ConvertKit"],
    funnelStageEmphasis: {
      awareness: 65,
      consideration: 70,
      conversion: 55,
      loyalty: 80,
    },
    contentFormats: [
      { label: "Stories", value: 28 },
      { label: "Live Sessions", value: 22 },
      { label: "YouTube", value: 18 },
      { label: "Email Series", value: 16 },
      { label: "Guides", value: 16 },
    ],
  },
  {
    slug: "liam-chen",
    name: "Liam Chen",
    role: "SaaS Founder & Solo Builder",
    age: 29,
    avatar: "/personas/liam-chen.jpg",
    headline: "Hands-on founder optimizing every touchpoint for efficient product-led growth.",
    personalityTags: ["Analytical", "Builder", "No-nonsense"],
    quote: "If I'm not learning from every campaign, I'm burning cash.",
    basics: {
      location: "Seattle, WA",
      income: "$210K from ARR + consulting",
      education: "M.S. Computer Science, UW",
      devices: "Framework Laptop, Pixel 8 Pro, custom-built dashboard",
    },
    brandValues: ["Efficiency", "Clarity", "Signal"],
    digitalBehavior: [
      "Publishes detailed build-in-public threads on X every Tuesday/Thursday",
      "Runs automated onboarding experiments weekly using feature flags",
      "Records short Loom updates for paid users highlighting roadmap changes",
      "Aggregates product analytics, CRM, and support tickets into one Notion workspace",
    ],
    goals: [
      "Prioritize marketing channels that correlate with product activation",
      "Spot drop-off moments between trial and paid conversion",
      "Identify micro-influencer partnerships that drive developer trust",
    ],
    painPoints: [
      "Drowning in vanity metrics from multiple growth tools",
      "Manual attribution makes it tough to justify ad spend to himself and investors",
      "Limited bandwidth to create content while shipping code",
    ],
    preferredPlatforms: ["X", "Product Hunt", "Reddit", "Loom"],
    funnelStageEmphasis: {
      awareness: 55,
      consideration: 75,
      conversion: 85,
      loyalty: 60,
    },
    contentFormats: [
      { label: "Threads", value: 26 },
      { label: "Product Updates", value: 24 },
      { label: "Webinars", value: 18 },
      { label: "Case Studies", value: 17 },
      { label: "Newsletters", value: 15 },
    ],
  },
  {
    slug: "amara-patel",
    name: "Amara Patel",
    role: "Social Media Lead at DTC Brand",
    age: 34,
    avatar: "/personas/amara-patel.jpg",
    headline: "Strategic marketer obsessed with experiments and measurable ROI across channels.",
    personalityTags: ["Strategic", "Data-Driven", "Energetic"],
    quote: "Every test needs a KPI and a learning, otherwise it's just noise.",
    basics: {
      location: "Brooklyn, NY",
      income: "$145K salary + bonus",
      education: "B.A. Marketing, NYU",
      devices: "MacBook Pro, dual 4K monitors, iPhone 15",
    },
    brandValues: ["Experimentation", "Inclusivity", "Momentum"],
    digitalBehavior: [
      "Runs TikTok Spark Ads twice per quarter based on top organic performers",
      "Hosts cross-functional performance reviews every Monday with creative + product",
      "Uses Airtable automations to tag UGC creators by CPA performance",
      "Builds quarterly dashboards for CMO highlighting cohort-based retention",
    ],
    goals: [
      "Shorten the feedback loop between creative tests and revenue impact",
      "Scale UGC collaborations without compromising brand voice",
      "Forecast inventory needs based on social-driven demand spikes",
    ],
    painPoints: [
      "Data lives across TikTok Ads, Shopify, and attribution tools with conflicting numbers",
      "Hard to communicate experiment learnings to leadership quickly",
      "Need to defend top-of-funnel spend when finance wants last-click proof",
    ],
    preferredPlatforms: ["TikTok", "Instagram", "Airtable", "Shopify"],
    funnelStageEmphasis: {
      awareness: 75,
      consideration: 65,
      conversion: 70,
      loyalty: 68,
    },
    contentFormats: [
      { label: "UGC", value: 30 },
      { label: "Short Reels", value: 20 },
      { label: "Dashboards", value: 18 },
      { label: "Campaign Wraps", value: 17 },
      { label: "Podcasts", value: 15 },
    ],
  },
];

export function getPersonaBySlug(slug: string): Persona | undefined {
  return personas.find((persona) => persona.slug === slug);
}
