import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 text-white transition-colors duration-300",
        scrolled
          ? "border-b border-white/10 bg-primary/95 backdrop-blur supports-[backdrop-filter]:bg-primary/80"
          : "border-b border-white/10 bg-primary/80 backdrop-blur supports-[backdrop-filter]:bg-black/30",
      )}
    >
      <div className="flex h-16 items-center justify-between gap-6 px-[6%]">
        <Link to="/landing" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Tracemark</span>
        </Link>
        <nav className="hidden items-center gap-9 text-[15px] text-white/80 md:flex">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <a href="#how" className="transition-colors hover:text-white">How it works</a>
          <Link to="/plans" className="transition-colors hover:text-white">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          <Button asChild variant="ghost" className="text-[15px] text-white hover:bg-white/10 hover:text-white">
            <Link to="/auth/sign-in">Sign in</Link>
          </Button>
          <Button asChild className="text-[15px] bg-white text-primary hover:bg-white/90">
            <Link to="/auth/sign-up">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
