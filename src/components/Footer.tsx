import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";

import { Logo } from "@/components/Logo";
import { services } from "@/content/services";
import { CONTACT_EMAIL, SITE_NAME } from "@/content/site";

const company = [
  { to: "/about" as const, label: "About" },
  { to: "/portfolio" as const, label: "Portfolio" },
  { to: "/resources" as const, label: "Resources" },
  { to: "/contact" as const, label: "Contact" },
];

const legal = [
  { to: "/privacy" as const, label: "Privacy Policy" },
  { to: "/terms" as const, label: "Terms of Service" },
  { to: "/security" as const, label: "Security" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="lg:col-span-1">
          <Logo className="h-8" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate">
            Custom websites, web apps, mobile apps, and AI automation for businesses that have
            outgrown off-the-shelf software.
          </p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:text-primary-hover"
          >
            <Mail className="size-4" aria-hidden="true" />
            {CONTACT_EMAIL}
          </a>
        </div>

        <FooterColumn title="Services">
          {services.slice(0, 6).map((service) => (
            <li key={service.slug}>
              <Link to="/services" hash={service.slug} className="hover:text-headline">
                {service.name}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Company">
          {company.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="hover:text-headline">
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/industries" className="hover:text-headline">
              Industries
            </Link>
          </li>
        </FooterColumn>

        <FooterColumn title="Legal">
          {legal.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="hover:text-headline">
                {item.label}
              </Link>
            </li>
          ))}
        </FooterColumn>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <p>Built, secured, and maintained in-house.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-headline">{title}</h2>
      <ul className="mt-4 space-y-2.5 text-sm text-slate">{children}</ul>
    </div>
  );
}
