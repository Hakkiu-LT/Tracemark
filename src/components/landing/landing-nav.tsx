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
    const onScroll = () => setScrolled(window.scrollY > 10);
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
          "fixed inset-x-0 top-0 z-50 transition-all duration-200 border-b",
          scrolled
            ? "bg-background/80 backdrop-blur-md border-border/60 shadow-sm"
            : "bg-background/50 backdrop-blur-sm border-transparent"
        )}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-6 lg:px-8">
          <Link to="/landing" className="flex items-center gap-2 text-foreground transition-opacity hover:opacity-80">
            <HakkiuLogo className="h-6 text-foreground" />
            <span className="ml-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              AI 2.0
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-xs font-medium text-muted-foreground md:flex">
            <Link to="/landing" hash="features" className="transition-colors hover:text-foreground">
              Features
            </Link>
            <Link to="/landing" hash="how" className="transition-colors hover:text-foreground">
              How it works
            </Link>
            <Link to="/plans" className="transition-colors hover:text-foreground">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setSalesOpen(true)}
              className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            >
              Talk to sales
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsDark(!isDark)}
              className="h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild variant="ghost" className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground">
              <Link to="/auth/sign-in">Sign in</Link>
            </Button>
            <Button asChild className="h-8 rounded-md bg-foreground px-3.5 text-xs font-medium text-background hover:bg-foreground/90 transition-all shadow-sm">
              <Link to="/auth/sign-up">Deploy Brand Defense</Link>
            </Button>
          </div>
        </div>
      </header>

      <TalkToSalesModal open={salesOpen} onOpenChange={setSalesOpen} />
    </>
  );
}
