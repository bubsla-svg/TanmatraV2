export interface AuthUser {
  id?: string;
  phone?: string;
  isAuthenticated: boolean;
  token?: string;
}

let currentUser: AuthUser = { isAuthenticated: false };

export const AuthService = {
  buildAuthRedirectUrl(returnTo: string): string {
    const encoded = encodeURIComponent(returnTo);
    return `/auth?returnTo=${encoded}`;
  },

  login(phone: string): AuthUser {
    currentUser = {
      id: "usr_tanmatra_active",
      phone,
      isAuthenticated: true,
      token: "jwt_token_sample",
    };
    return currentUser;
  },

  logout(): AuthUser {
    currentUser = { isAuthenticated: false };
    return currentUser;
  },

  getCurrentUser(): AuthUser {
    return currentUser;
  },
};
