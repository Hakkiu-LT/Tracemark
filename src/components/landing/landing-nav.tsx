import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark") || localStorage.getItem("theme") === "dark";
    }
    return false;
  });

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
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300 border-b",
        scrolled
          ? "bg-background/80 text-foreground border-border backdrop-blur"
          : "bg-primary/95 text-white border-white/10 backdrop-blur"
      )}
    >
      <div className="flex h-16 items-center justify-between gap-6 px-[6%]">
        <Link to="/landing" className="flex items-center gap-2.5">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
            scrolled ? "bg-primary/10 text-primary" : "bg-white/10 text-white"
          )}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Tracemark</span>
        </Link>
        <nav className={cn(
          "hidden items-center gap-9 text-[15px] transition-colors md:flex",
          scrolled ? "text-muted-foreground" : "text-white/80"
        )}>
          <a href="#features" className={cn("transition-colors", scrolled ? "hover:text-foreground" : "hover:text-white")}>Features</a>
          <a href="#how" className={cn("transition-colors", scrolled ? "hover:text-foreground" : "hover:text-white")}>How it works</a>
          <Link to="/plans" className={cn("transition-colors", scrolled ? "hover:text-foreground" : "hover:text-white")}>Pricing</Link>
        </nav>
        <div className="flex items-center gap-2.5">
          <Button asChild variant="ghost" className={cn(
            "text-[15px] transition-colors",
            scrolled 
              ? "text-foreground hover:bg-muted" 
              : "text-white hover:bg-white/10 hover:text-white"
          )}>
            <Link to="/auth/sign-in">Sign in</Link>
          </Button>
          <Button asChild className={cn(
            "text-[15px] transition-colors",
            scrolled 
              ? "bg-primary text-primary-foreground hover:bg-primary/90" 
              : "bg-white text-primary hover:bg-white/90"
          )}>
            <Link to="/auth/sign-up">Sign up</Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDark(!isDark)}
            className={cn(
              "h-10 w-10 rounded-full transition-colors",
              scrolled
                ? "text-foreground hover:bg-muted"
                : "text-white hover:bg-white/10 hover:text-white"
            )}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
