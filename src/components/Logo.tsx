import { Link } from "@tanstack/react-router";

const logo = "/__l5e/assets-v1/9dc38178-e3c5-4097-bbc8-7eae353e336d/blexware-logo.png";

export function Logo({
  className = "h-8",
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "onDark";
}) {
  return (
    <Link to="/" className="inline-flex items-center" aria-label="BLEXware home">
      {variant === "onDark" ? (
        <span className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
          <span className="text-mint">BLEX</span>
          <span className="text-headline">ware</span>
        </span>
      ) : (
        <img src={logo} alt="BLEXware" className={`${className} w-auto`} width={480} height={120} />
      )}
    </Link>
  );
}
