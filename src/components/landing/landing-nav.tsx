import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sun, Moon } from "lucide-react";
import { HakkiuLogo } from "@/components/hakkiu-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TalkToSalesModal } from "./talk-to-sales-modal";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    }
    return false;
  });
  const [salesOpen, setSalesOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300 border-b",
          scrolled
            ? "bg-background/80 text-foreground border-border backdrop-blur"
            : "bg-primary/95 text-white border-white/10 backdrop-blur",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-6 px-[6%]">
          <Link to="/landing" className="flex items-center">
            <HakkiuLogo
              className={cn("h-8 transition-colors", scrolled ? "text-foreground" : "text-white")}
            />
          </Link>

          <nav
            className={cn(
              "hidden items-center gap-9 text-[15px] transition-colors md:flex",
              scrolled ? "text-muted-foreground" : "text-white/80",
            )}
          >
            <Link
              to="/landing"
              hash="features"
              className={cn("transition-colors", scrolled ? "hover:text-foreground" : "hover:text-white")}
            >
              Features
            </Link>
            <Link
              to="/landing"
              hash="how"
              className={cn("transition-colors", scrolled ? "hover:text-foreground" : "hover:text-white")}
            >
              How it works
            </Link>
            <Link
              to="/plans"
              className={cn("transition-colors", scrolled ? "hover:text-foreground" : "hover:text-white")}
            >
              Pricing
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {/* Talk to sales */}
            <Button
              variant="ghost"
              onClick={() => setSalesOpen(true)}
              className={cn(
                "hidden md:inline-flex text-[15px] transition-colors",
                scrolled
                  ? "text-foreground hover:bg-muted"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              Talk to sales
            </Button>

            {/* Book a demo — navigates to full-page form */}
            <Button
              asChild
              className={cn(
                "text-[15px] font-semibold transition-colors",
                scrolled
                  ? "bg-[oklch(0.55_0.19_262)] text-white hover:bg-[oklch(0.5_0.19_262)]"
                  : "bg-white text-primary hover:bg-white/90",
              )}
            >
              <Link to="/request-demo">Book a demo</Link>
            </Button>

            {/* Dark mode toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              className={cn(
                "h-10 w-10 rounded-full transition-colors",
                scrolled
                  ? "text-foreground hover:bg-muted"
                  : "text-white hover:bg-white/10 hover:text-white",
              )}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      <TalkToSalesModal open={salesOpen} onOpenChange={setSalesOpen} />
    </>
  );
}
