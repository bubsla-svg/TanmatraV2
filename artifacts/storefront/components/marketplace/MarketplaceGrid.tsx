"use client";
import React from "react";
import { MarketplaceItem } from "@/lib/marketplaceApi";

export function MarketplaceGrid({ initialItems }: { initialItems: MarketplaceItem[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {initialItems.map((item) => (
        <div key={item.slug} className="border border-line p-4 rounded-xl">
          <h3 className="font-semibold text-ink">{item.name}</h3>
        </div>
      ))}
    </div>
  );
}
