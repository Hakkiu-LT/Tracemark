import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export interface TimelineEvent {
  id: string;
  type: "flagged" | "analyzing" | "escalated" | "takedown_sent" | "resolved" | "safe" | "active" | "error";
  timestamp: string;
  title: string;
  description?: string;
}

export function CaseTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No timeline events available.
        </CardContent>
      </Card>
    );
  }

  const getEventIcon = (type: TimelineEvent["type"]) => {
    switch (type) {
      case "flagged":
      case "active":
      case "error":
        return <AlertTriangle className="h-4 w-4 text-risk-high" />;
      case "analyzing":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "escalated":
        return <AlertTriangle className="h-4 w-4 text-accent" />;
      case "takedown_sent":
        return <Mail className="h-4 w-4 text-primary" />;
      case "resolved":
      case "safe":
        return <ShieldCheck className="h-4 w-4 text-success" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase mb-6">
          CASE TIMELINE
        </h3>
        <div className="space-y-6 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border">
          {events.map((event, index) => (
            <div key={event.id || index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-background bg-muted shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                {getEventIcon(event.type)}
              </div>
              <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-4 rounded border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground capitalize">
                    {event.title}
                  </span>
                  <time className="font-mono text-[10px] text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "numeric",
                    })}
                  </time>
                </div>
                {event.description && (
                  <p className="text-xs text-muted-foreground">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
