import { redirect } from "next/navigation";

type Params = { params: Promise<{ slug: string }> };

/**
 * Section 3.2 Canonical compatibility redirect:
 * /dish/[slug] -> /menu/[productSlug]
 */
export default async function DishRedirect({ params }: Params) {
  const { slug } = await params;
  redirect(`/menu/${slug}`);
}
