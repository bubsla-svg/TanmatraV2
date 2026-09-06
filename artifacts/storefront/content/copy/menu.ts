export const menuCopy = {
  header: {
    title: "Clinical Meal Protocols",
    subtitle: "Meals built around your goals, with the numbers published on every dish.",
  },
  filters: {
    all: "All Meals",
    pcos: "PCOS Protocol",
    diabetes: "Diabetes Protocol",
    weight: "Weight Management",
    gut: "Gut Health",
    hypertension: "DASH / Cardiac",
  },
  specSheet: {
    caloriesLabel: "Calories",
    proteinLabel: "Protein",
    carbsLabel: "Net Carbs",
    fatLabel: "Fats",
    fiberLabel: "Dietary Fiber",
    glycemicIndexLabel: "Glycemic Index",
    allergensLabel: "Allergens & Ingredients",
  },
  groupBanner: {
    title: "Ordering for a group or office?",
    subtitle: "Coordinate team meals with automated billing and custom meal preferences.",
    cta: "Explore Corporate Plans",
  },
  empty: {
    noResults: "No meals found matching your current filter criteria.",
    resetFilters: "Clear filters to view all clinical protocol options.",
  },
} as const;
