import { NavEntryCard } from "./NavEntryCard";

/** D-05B: -> /clinical. No label was supplied for this entry in the ruling;
 *  "Clinical support" is the component's own name, rendered plainly. */
export function ClinicalSupportEntry() {
  return <NavEntryCard label="Clinical support" href="/clinical" />;
}
