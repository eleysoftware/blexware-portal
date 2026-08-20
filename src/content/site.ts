import { readEnv } from "@/config/env";

export const SITE_URL = readEnv("VITE_APP_URL", "APP_URL")?.replace(/\/$/, "") ?? "https://blexware.com";
export const SITE_NAME = "BLEXware";
export const CONTACT_EMAIL = "hello@blexware.com";

export const projectTypes = [
  "Website",
  "Web Application",
  "Mobile App",
  "AI Automation",
  "Custom Software",
] as const;

export const budgetRanges = [
  "Under $2,500",
  "$2,500 - $5,000",
  "$5,000 - $10,000",
  "$10,000 - $25,000",
  "$25,000+",
] as const;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const navLinks = [
  { to: "/industries", label: "Industries" },
  { to: "/services", label: "Services" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/resources", label: "Resources" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;
