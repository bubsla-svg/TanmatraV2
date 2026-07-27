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
    edit: "Edit",
    delete: "Delete",
    viewDetails: "View details",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    network: "Unable to connect. Please check your internet connection.",
    sessionExpired: "Your session has expired. Please sign in again.",
    unauthorized: "You need to be signed in to perform this action.",
    forbidden: "You do not have permission to access this resource.",
    notFound: "The requested item could not be found.",
  },
  loading: {
    default: "Loading...",
    processing: "Processing your request...",
    saving: "Saving changes...",
  },
  offline: {
    banner: "You are currently offline. Some features may be unavailable.",
  },
  empty: {
    noData: "No items to display.",
  },
} as const;
