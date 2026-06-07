import { Store, ShoppingCart, Globe, Tag, Megaphone, Video, Link as LinkIcon } from "lucide-react";
import type { Platform } from "./store";

type PlatformCategory = typeof PLATFORM_GROUPS[number]["key"];


export const PLATFORM_GROUPS = [
  { key: "shops", label: "Shops"        },
  { key: "ads",   label: "Ad platforms" },
  { key: "other", label: "Others"       },
] as const;

export const PLATFORMS: {
  id: Platform;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  category: PlatformCategory;
  stepLabel: string;
  apiKey: string;
}[] = [
  { 
    id: "Amazon",     
    label: "Amazon",      
    icon: Store,     
    category: "shops", 
    stepLabel: "Scanning Amazon marketplace",  
    apiKey: "amazon"     
  },
  { 
    id: "Google",     
    label: "Google",      
    icon: Megaphone, 
    category: "ads",   
    stepLabel: "Checking Google Ads",           
    apiKey: "google_ads" 
  },
  { 
    id: "Meta",       
    label: "Meta",        
    icon: Megaphone, category: "ads",   
    stepLabel: "Checking Meta Ads",            
    apiKey: "meta_ads"   
  },
  { 
    id: "Web Domain", 
    label: "Web Domain",  
    icon: LinkIcon,  
    category: "other", 
    stepLabel: "Running WHOIS domain lookup",   
    apiKey: "domains"    
  },
/*{ id: "Shopify",    label: "Shopify Network", icon: ShoppingCart, category: "shops", stepLabel: "Scanning Shopify network",   apiKey: "shopify"    },
  { id: "eBay",       label: "eBay",            icon: Tag,          category: "shops", stepLabel: "Scanning eBay listings",     apiKey: "ebay"       },
  { id: "AliExpress", label: "AliExpress",      icon: Globe,        category: "shops", stepLabel: "Scanning AliExpress listings", apiKey: "aliexpress" },
  { id: "Instagram",  label: "Instagram",       icon: Video,        category: "other", stepLabel: "Scanning Instagram",         apiKey: "instagram"  },
  { id: "TikTok",     label: "TikTok",          icon: Video,        category: "other", stepLabel: "Scanning TikTok",            apiKey: "tiktok"     }, */
];


