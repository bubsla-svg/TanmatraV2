/**
 * Unit test suite for /geo/* routes, geocoding precision, and dual-key resilience.
 * Verifies that multi-tier Indian addresses and NCR sectors accurately harvest PIN codes
 * and locality names across all returned polygon results rather than failing on sparse premise tiers.
 *
 * Run: node --test --import tsx ./src/routes/geo.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { precisePlaceFrom } from "./geo";

test("precisePlaceFrom harvests authoritative PIN code and locality across sparse premise tiers", () => {
  // Simulate standard Google Maps reverse geocode response in NCR where results[0] is an establishment
  // lacking postal code and locality, while subsequent bounding tiers carry accurate sector and PIN data.
  const sampleResults = [
    {
      formatted_address: "Kettle Fit Gym, Galli Number 52, Sector 24, Gurugram",
      address_components: [
        { long_name: "Kettle Fit Gym", types: ["point_of_interest", "establishment"] },
        { long_name: "Galli Number 52", types: ["route"] },
      ],
    },
    {
      formatted_address: "Sector 24, Gurugram, Haryana 122002, India",
      address_components: [
        { long_name: "Sector 24", types: ["sublocality_level_1", "sublocality", "political"] },
        { long_name: "Gurugram", types: ["locality", "political"] },
        { long_name: "Haryana", types: ["administrative_area_level_1", "political"] },
        { long_name: "122002", types: ["postal_code"] },
      ],
    },
  ];

  const place = precisePlaceFrom(sampleResults);
  assert.equal(place.pincode, "122002", "PIN code should be discovered in secondary polygon tier");
  assert.equal(place.city, "Gurugram", "Locality should be discovered from locality type in secondary tier");
  assert.equal(place.formattedAddress, "Kettle Fit Gym, Galli Number 52, Sector 24, Gurugram");
});

test("precisePlaceFrom falls back through sublocality and administrative tiers for NCR sectors", () => {
  // In certain NCR zones (e.g. suburban Noida or Greater Noida), Google omits 'locality' entirely
  // and classifies the sector under sublocality_level_1 or administrative_area_level_2.
  const sampleResults = [
    {
      formatted_address: "U Block, DLF Phase 3, Sector 24, Gurugram, Haryana 122002",
      address_components: [
        { long_name: "U Block", types: ["sublocality_level_2", "sublocality", "political"] },
        { long_name: "DLF Phase 3", types: ["sublocality_level_1", "sublocality", "political"] },
        { long_name: "Gautam Buddha Nagar", types: ["administrative_area_level_2", "political"] },
        { long_name: "201301", types: ["postal_code"] },
      ],
    },
  ];

  const place = precisePlaceFrom(sampleResults);
  assert.equal(place.pincode, "201301");
  assert.equal(place.city, "DLF Phase 3", "Should fall back to sublocality_level_1 when locality is missing");
});

test("precisePlaceFrom skips standalone plus-code prefixes in favor of human-readable street formatting", () => {
  const sampleResults = [
    {
      formatted_address: "H8JM+9X, Sector 24, Gurugram, Haryana 122002, India",
      address_components: [
        { long_name: "H8JM+9X", types: ["plus_code"] },
      ],
    },
    {
      formatted_address: "Plot 12, Sector 24, Gurugram, Haryana 122002, India",
      address_components: [
        { long_name: "Gurugram", types: ["locality"] },
        { long_name: "122002", types: ["postal_code"] },
      ],
    },
  ];

  const place = precisePlaceFrom(sampleResults);
  assert.equal(place.formattedAddress, "Plot 12, Sector 24, Gurugram, Haryana 122002, India", "Must skip cryptic plus-code string when clean street address exists in subsequent tier");
  assert.equal(place.city, "Gurugram");
  assert.equal(place.pincode, "122002");
});

test("precisePlaceFrom handles empty results gracefully without throwing", () => {
  const place = precisePlaceFrom([]);
  assert.deepEqual(place, { formattedAddress: "", city: "", pincode: "" });
});
