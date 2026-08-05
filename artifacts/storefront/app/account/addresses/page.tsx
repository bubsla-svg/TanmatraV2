import type { Metadata } from "next";
import AddressesClient from "./AddressesClient";

export const metadata: Metadata = {
  title: "ADDRESSES | Tanmatra",
};

export default function AddressesPage() {
  return <AddressesClient />;
}
