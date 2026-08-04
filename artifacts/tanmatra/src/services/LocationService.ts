export interface DeliveryLocation {
  pincode: string;
  city: string;
  addressLine?: string;
  isServiceable: boolean;
  estimatedDeliveryTimeMinutes?: number;
}

const SERVICEABLE_PINCODES: Record<string, { city: string; etaMins: number }> = {
  "560001": { city: "Bengaluru Central", etaMins: 35 },
  "560034": { city: "Koramangala", etaMins: 25 },
  "560038": { city: "Indiranagar", etaMins: 30 },
  "560102": { city: "HSR Layout", etaMins: 20 },
  "110001": { city: "New Delhi", etaMins: 45 },
  "400001": { city: "Mumbai South", etaMins: 40 },
};

export class LocationService {
  private static currentLocation: DeliveryLocation = {
    pincode: "560034",
    city: "Koramangala",
    isServiceable: true,
    estimatedDeliveryTimeMinutes: 25,
  };

  static getCurrentLocation(): DeliveryLocation {
    return this.currentLocation;
  }

  static checkServiceability(pincode: string): DeliveryLocation {
    const data = SERVICEABLE_PINCODES[pincode.trim()];
    if (data) {
      this.currentLocation = {
        pincode: pincode.trim(),
        city: data.city,
        isServiceable: true,
        estimatedDeliveryTimeMinutes: data.etaMins,
      };
    } else {
      this.currentLocation = {
        pincode: pincode.trim(),
        city: "Unknown Area",
        isServiceable: false,
      };
    }
    return this.currentLocation;
  }
}
