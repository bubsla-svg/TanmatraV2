import { motion } from "framer-motion";

type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type DishNutritionCardProps = {
  macros: Macros;
};

export default function DishNutritionCard({ macros }: DishNutritionCardProps) {
  const stats = [
    { label: "Calories", value: macros.calories, unit: "kcal", color: "text-nn-primary" },
    { label: "Protein", value: macros.protein, unit: "g", color: "text-nn-tertiary" },
    { label: "Carbs", value: macros.carbs, unit: "g", color: "text-clinical-sage" },
    { label: "Fat", value: macros.fat, unit: "g", color: "text-nn-on-surface-variant" },
  ];

  return (
    <motion.div
      initial={{ scale: 0.97, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="p-5 rounded-xl bg-gradient-to-br from-nn-primary/10 to-nn-tertiary/5 border border-nn-primary/30"
    >
      <p className="text-[10px] uppercase tracking-[0.18em] text-nn-primary font-semibold mb-4">
        Nutritional Profile
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -2 }}
            className="text-center p-3 rounded-lg bg-nn-bg/50 border border-white/[0.08] hover:border-white/[0.08] transition-colors"
          >
            <p className="text-[10px] uppercase tracking-[0.12em] text-nn-secondary font-semibold mb-1">
              {stat.label}
            </p>
            <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>
              {stat.value}
              <span className="text-xs ml-1 font-normal text-nn-on-surface-variant">
                {stat.unit}
              </span>
            </p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
