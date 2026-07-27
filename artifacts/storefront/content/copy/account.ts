export const accountCopy = {
  nav: {
    overview: "Account Overview",
    subscriptions: "Subscriptions",
    orders: "Order History",
    addresses: "Saved Addresses",
    preferences: "Dietary Preferences",
    symptoms: "Symptom Log",
  },
  overview: {
    welcome: "Welcome back, {name}",
    activeSubscription: "Active Protocol: {protocolName}",
    nextDelivery: "Next Delivery: {deliveryDate}",
  },
  orders: {
    empty: "You have no past orders.",
    viewReceipt: "View Receipt",
  },
  addresses: {
    addNew: "Add New Address",
    defaultTag: "Default",
  },
  preferences: {
    title: "Dietary Restrictions & Allergies",
    subtitle: "Select any ingredients you must exclude from your meals.",
  },
} as const;
