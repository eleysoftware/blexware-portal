import { Link } from "@tanstack/react-router";

import logo from "@/assets/blexware-logo.png";

export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="BLEXware home">
      <img src={logo} alt="BLEXware" className={`${className} w-auto`} width={480} height={120} />
    </Link>
  );
}
