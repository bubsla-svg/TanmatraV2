import type { Metadata } from "next";
import CustomBuildClient from "./CustomBuildClient";

export const metadata: Metadata = {
  title: "Custom Build | Tanmatra",
};

export default function CustomBuildPage() {
  return <CustomBuildClient />;
}
