import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * TNM-UIF-01 Phase 0 proof set — the shadcn/token-bridge components rendered
 * from tokens alone. Flip the document `data-theme` to verify both themes read
 * correctly with no `dark:` forks. Saffron is the only action colour; sage
 * appears only as a signal badge; focus rings are the AA saffron ring.
 */
function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        {title}
      </h3>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export function ComponentProofs() {
  return (
    <div className="flex flex-col gap-8">
      <Row title="Buttons — variants">
        <Button>Add to cart</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Remove</Button>
        <Button variant="link">Link</Button>
        <Button disabled>Disabled</Button>
      </Row>

      <Row title="Buttons — sizes">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
      </Row>

      <Row title="Badges (sage = veg / wellness signal, never interactive)">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="sage">Veg</Badge>
        <Badge variant="outline">Plan-fit</Badge>
        <Badge variant="destructive">Out of stock</Badge>
      </Row>

      <Row title="Card">
        <Card className="w-72">
          <CardHeader>
            <CardTitle>Paneer Bhurji Bowl</CardTitle>
            <CardDescription>High-protein, RD-designed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="tabular text-sm text-muted-foreground">
              520 kcal · 32P · 41C · 18F
            </p>
          </CardContent>
          <CardFooter className="justify-between">
            <span className="tabular font-semibold text-foreground">₹249</span>
            <Button size="sm">Add</Button>
          </CardFooter>
        </Card>
      </Row>

      <Row title="Skeleton (reserves real dimensions — CLS guardrail)">
        <div className="flex w-72 flex-col gap-3 rounded-xl border border-border p-4">
          <Skeleton className="aspect-[4/3] w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Row>
    </div>
  );
}
