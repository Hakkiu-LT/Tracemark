import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CompanyLogo } from "@/components/company-logo";
import { Button } from "@/components/ui/button";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { cn } from "@/lib/utils";
import { useLeadModals } from "./lead-modals";
import { ThemeToggle } from "@/components/theme-toggle";

export function LandingNav() {
  const { openDemo, openSales } = useLeadModals();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-200 border-b",
          scrolled
            ? "bg-background/80 backdrop-blur-md border-border/60 shadow-sm"
            : "bg-background/50 backdrop-blur-sm border-transparent",
        )}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-6 lg:px-8">
          <Link
            to="/"
            className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80"
          >
            <CompanyLogo className="h-6 text-foreground" />
            <span className="ml-1 hidden rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
              AI 2.0
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-xs font-medium text-muted-foreground md:flex">
            <Link to="/" hash="features" className="transition-colors hover:text-foreground">
              Platform
            </Link>
            <Link to="/" hash="how" className="transition-colors hover:text-foreground">
              How it works
            </Link>
            <Link to="/" hash="coverage" className="transition-colors hover:text-foreground">
              Coverage
            </Link>
            <Link to="/" hash="faq" className="transition-colors hover:text-foreground">
              FAQ
            </Link>
            <Link to="/legal/security" className="transition-colors hover:text-foreground">
              Security
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              onClick={openSales}
              className="hidden h-8 rounded-md border-border px-3.5 text-xs font-medium text-foreground hover:bg-muted hover:text-foreground cursor-pointer sm:inline-flex"
            >
              Talk to sales
            </Button>
            <RainbowButton
              type="button"
              onClick={openDemo}
              className="h-8 rounded-lg px-4 text-xs"
            >
              Book a demo
            </RainbowButton>
          </div>
        </div>
      </header>
    </>
  );
}
