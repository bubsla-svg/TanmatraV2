export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  phone: string;
  isAuthenticated: boolean;
  corporateBenefitId?: string;
  savedAddresses: string[];
}

export class AuthService {
  private static currentUser: UserProfile = {
    userId: "guest_anon",
    name: "Guest User",
    email: "",
    phone: "",
    isAuthenticated: false,
    savedAddresses: [],
  };

  static getCurrentUser(): UserProfile {
    return this.currentUser;
  }

  static login(phone: string): UserProfile {
    this.currentUser = {
      userId: `usr_${Date.now()}`,
      name: "Tanmatra Member",
      email: "member@tanmatra.food",
      phone,
      isAuthenticated: true,
      savedAddresses: ["560034, Koramangala"],
    };
    return this.currentUser;
  }

  static logout(): void {
    this.currentUser = {
      userId: "guest_anon",
      name: "Guest User",
      email: "",
      phone: "",
      isAuthenticated: false,
      savedAddresses: [],
    };
  }

  /**
   * Builds valid return route URL preserving destination after authentication
   */
  static buildAuthRedirectUrl(targetRoute: string): string {
    const encoded = encodeURIComponent(targetRoute);
    return `/auth?returnTo=${encoded}`;
  }
}
