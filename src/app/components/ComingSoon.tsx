import { PageHeader } from "./PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-lg font-semibold">Coming soon</div>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            This module is planned for the next phase. Your leads, AI qualification, and pipeline are fully live in the meantime.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
