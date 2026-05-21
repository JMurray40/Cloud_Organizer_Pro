import { Link } from "wouter";
import { FileQuestion, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-5">
          <FileQuestion className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-2">404</h1>
        <p className="text-base font-medium text-foreground mb-1">Page not found</p>
        <p className="text-sm text-muted-foreground mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link href="/">
          <Button variant="default" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Button>
        </Link>
      </div>
    </div>
  );
}
