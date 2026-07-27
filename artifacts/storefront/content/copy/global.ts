export const globalCopy = {
  buttons: {
    submit: "Submit",
    save: "Save changes",
    cancel: "Cancel",
    confirm: "Confirm",
    back: "Back",
    continue: "Continue",
    retry: "Try again",
    close: "Close",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    network: "Unable to connect. Check your internet connection.",
    sessionExpired: "Your session has expired. Please sign in again.",
    unauthorized: "You need to be signed in to perform this action.",
  },
  loading: {
    default: "Loading...",
    processing: "Processing your request...",
  },
  offline: {
    banner: "You are currently offline. Some features may be unavailable.",
  },
} as const;
