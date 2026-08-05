import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchMenu, findDish } from "@/lib/catalog";
import { ProductDetailView } from "@/components/menu/ProductDetailView";

type Params = { params: Promise<{ productSlug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { productSlug } = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(productSlug, dishes);
  if (!dish) return { title: "Dish not found" };
  return { title: dish.name, description: dish.tasteDescription || dish.description };
}

export default async function ProductDetailPage({ params }: Params) {
  const { productSlug } = await params;
  const { dishes } = await fetchMenu();
  const dish = findDish(productSlug, dishes);
  if (!dish) notFound();

  return <ProductDetailView dish={dish} />;
}
