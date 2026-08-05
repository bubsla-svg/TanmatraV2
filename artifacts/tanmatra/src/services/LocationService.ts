export interface ServiceabilityResult {
  isServiceable: boolean;
  pincode: string;
  city?: string;
  clusterId?: string;
  nextSlot?: string;
}

const SERVICEABLE_PINCODES: Record<string, string> = {
  "560034": "Koramangala",
  "560038": "Indiranagar",
  "560001": "Central Bengaluru",
  "560102": "HSR Layout",
  "560068": "BTM Layout",
  "560076": "Bannerghatta Road",
  "560066": "Whitefield",
  "560100": "Electronic City",
};

export const LocationService = {
  checkServiceability(pincode: string): ServiceabilityResult {
    const cleaned = (pincode || "").trim();
    if (SERVICEABLE_PINCODES[cleaned]) {
      return {
        isServiceable: true,
        pincode: cleaned,
        city: SERVICEABLE_PINCODES[cleaned],
        clusterId: "BLR_SOUTH_1",
        nextSlot: "Tomorrow 07:30 AM",
      };
    }

    if (/^560\d{3}$/.test(cleaned)) {
      return {
        isServiceable: true,
        pincode: cleaned,
        city: "Bengaluru Metro",
        clusterId: "BLR_CENTRAL_1",
        nextSlot: "Tomorrow 07:30 AM",
      };
    }

    return {
      isServiceable: false,
      pincode: cleaned,
    };
  },
};
