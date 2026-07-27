import { Link } from "@tanstack/react-router";
import {
  ShoppingCart,
  Tag,
  ShoppingBag,
  Globe,
  Facebook,
  Store,
  Apple,
  Instagram,
  Music2,
  Package,
  Youtube,
  Play,
  ArrowRight,
} from "lucide-react";

const CHANNELS = [
  { name: "Amazon", icon: ShoppingCart },
  { name: "Shopify", icon: ShoppingBag },
  { name: "eBay", icon: Tag },
  { name: "Alibaba", icon: Store },
  { name: "Instagram", icon: Instagram },
  { name: "Facebook", icon: Facebook },
  { name: "TikTok", icon: Music2 },
  { name: "Web Domains", icon: Globe },
  { name: "Etsy", icon: Store },
  { name: "AliExpress", icon: Package },
  { name: "App Stores", icon: Apple },
  { name: "YouTube", icon: Youtube },
  { name: "Google Shopping", icon: Play },
];

export function Coverage() {
  return (
    <section className="relative overflow-hidden border-b border-border/60 bg-muted/20 py-20">
      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <p className="font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          COMPREHENSIVE MULTI-CHANNEL SURVEILLANCE
        </p>
        
        <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
          Complete coverage across every market where infringers hide.
        </h2>
        
        <p className="mt-4 mx-auto max-w-2xl text-base text-muted-foreground">
          Continuous AI scanning across e-commerce marketplaces, social commerce networks, domain registrars, and independent web storefronts.
        </p>

        {/* Clean Vercel-style Logo & Channel Grid */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon;
            return (
              <div
                key={channel.name}
                className="group flex items-center justify-center gap-2.5 rounded-lg border border-border/80 bg-card p-3.5 shadow-sm transition-all hover:border-foreground/40 hover:shadow-md"
              >
                <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                <span className="text-xs font-medium text-foreground">{channel.name}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex items-center justify-center">
          <Link
            to="/request-demo"
            className="inline-flex items-center gap-2 text-xs font-semibold text-foreground transition-all hover:text-muted-foreground"
          >
            Explore enterprise channel coverage rules
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
