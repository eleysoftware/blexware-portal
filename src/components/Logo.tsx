import { Link } from "@tanstack/react-router";

const logo = "/__l5e/assets-v1/9dc38178-e3c5-4097-bbc8-7eae353e336d/blexware-logo.png";

export function Logo({ className = "h-8" }: { className?: string }) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="BLEXware home">
      <img src={logo} alt="BLEXware" className={`${className} w-auto`} width={480} height={120} />
    </Link>
  );
}
