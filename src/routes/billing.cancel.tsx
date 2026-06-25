import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/billing/cancel")({
  head: () => ({
    meta: [
      { title: "Checkout Cancelled — Tracemark" },
      { name: "description", content: "Your checkout transaction was cancelled." },
    ],
  }),
  component: CancelPage,
});

function CancelPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-border/80 shadow-lg text-center bg-card/65 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-amber-500" />
        
        <CardHeader className="pt-8">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-amber-500 animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Checkout Cancelled</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">
            No changes were made to your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6 text-sm text-muted-foreground leading-relaxed">
          The transaction process was cancelled by the user. If you experienced any issues during the credit card processing step, please reach out to our engineering support at support@tracemark.io.
        </CardContent>

        <CardFooter className="bg-muted/10 border-t border-border/50 p-6">
          <Button asChild variant="outline" className="w-full cursor-pointer gap-2">
            <Link to="/plans">
              <ArrowLeft className="h-4 w-4" /> Return to Plans
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
