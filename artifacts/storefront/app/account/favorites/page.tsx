import type { Metadata } from "next";
import FavoritesClient from "./FavoritesClient";

export const metadata: Metadata = {
  title: "FAVORITES | Tanmatra",
};

export default function FavoritesPage() {
  return <FavoritesClient />;
}
