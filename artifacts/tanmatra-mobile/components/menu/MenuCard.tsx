import {Feather} from '@expo/vector-icons';
import React, {useState} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';

export interface MenuCardProps {
  id: string;
  name: string;
  price: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description: string;
  imageUrl: string;
  protocol: 'Wellness' | 'Performance' | 'Clinical';
  tags: string;
}

type PurchaseTier = 'single' | 'trial' | 'weekly';

/**
 * Menu dish card. Re-ported from a web/DOM prototype into real React Native —
 * the previous version used web DOM elements (<div>/<img>/<svg>) + Tailwind
 * classNames, which are not valid RN components and would throw if rendered.
 * Not yet wired into the app's navigation (see index.tsx); this is a valid,
 * ready-to-use RN component.
 */
export const MenuCard: React.FC<MenuCardProps> = ({
  name,
  price,
  calories,
  protein,
  carbs,
  fat,
  description,
  imageUrl,
  protocol,
}) => {
  const [purchaseTier, setPurchaseTier] = useState<PurchaseTier>('single');
  const [isAdded, setIsAdded] = useState(false);

  const discountedTrialPrice = Math.round(price * 3 * 0.75); // 25% off 3-day trial
  const weeklyPlanPrice =
    protocol === 'Performance' ? 7490 : protocol === 'Clinical' ? 5990 : 5490;

  const handleAddToCart = () => {
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  const protocolColor =
    protocol === 'Wellness'
      ? COLORS.emerald500
      : protocol === 'Performance'
        ? COLORS.orange500
        : COLORS.blue500;

  const ctaLabel = isAdded
    ? 'SUCCESSFULLY ADDED TO CART!'
    : purchaseTier === 'single'
      ? `ADD PORTION MEAL TO CART  ·  ₹${price}`
      : purchaseTier === 'trial'
        ? `ACTIVATE 3-DAY PROTOCOL TRIAL  ·  ₹${discountedTrialPrice}`
        : `INITIATE SUBSCRIPTION AUTO-PAY  ·  ₹${weeklyPlanPrice}`;

  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Image source={{uri: imageUrl}} style={styles.image} resizeMode="cover" />
        <View style={styles.trustSeal}>
          <Feather name="shield" size={12} color={COLORS.emerald400} />
          <Text style={styles.trustSealText}>RD Advisory Board Verified</Text>
        </View>
        <View style={styles.protocolBadgeRow}>
          <View style={[styles.protocolBadge, {backgroundColor: protocolColor}]}>
            <Text style={styles.protocolBadgeText}>{protocol} Protocol</Text>
          </View>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{name}</Text>
          <Text style={styles.price}>₹{price}</Text>
        </View>

        <Text style={styles.description}>{description}</Text>

        <View style={styles.macroRow}>
          <MacroPill label="Calories" value={`${calories} kcal`} />
          <MacroPill label="Protein" value={`${protein}g`} tint={COLORS.emerald700} labelTint={COLORS.emerald600} divider />
          <MacroPill label="Carbs" value={`${carbs}g`} tint={COLORS.orange700} labelTint={COLORS.orange600} divider />
          <MacroPill label="Fat" value={`${fat}g`} tint={COLORS.blue700} labelTint={COLORS.blue600} divider />
        </View>

        <View style={styles.tierBlock}>
          <Text style={styles.tierHeading}>SELECT PROGRAM PREFERENCE</Text>

          <TierOption
            selected={purchaseTier === 'single'}
            onPress={() => setPurchaseTier('single')}
            accent={COLORS.slate900}
            title="Single Portion Meal"
            subtitle="Includes baseline thermodynamic profile"
            price={`₹${price}`}
          />
          <TierOption
            selected={purchaseTier === 'trial'}
            onPress={() => setPurchaseTier('trial')}
            accent={COLORS.emerald500}
            title="Start 3-Day Protocol Trial"
            badge="25% OFF"
            subtitle="Perfect clinical testing window"
            price={`₹${discountedTrialPrice}`}
          />
          <TierOption
            selected={purchaseTier === 'weekly'}
            onPress={() => setPurchaseTier('weekly')}
            accent={COLORS.indigo500}
            title="Subscribe & Save (Weekly Protocol)"
            subtitle="Same-day delivery, swap dishes anytime"
            price={`₹${weeklyPlanPrice}/wk`}
          />
        </View>

        <Pressable
          onPress={handleAddToCart}
          style={[styles.cta, isAdded ? styles.ctaAdded : styles.ctaDefault]}>
          {isAdded ? (
            <View style={styles.ctaAddedRow}>
              <Feather name="check" size={16} color={COLORS.white} />
              <Text style={styles.ctaText}>{ctaLabel}</Text>
            </View>
          ) : (
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

function MacroPill({
  label,
  value,
  tint,
  labelTint,
  divider,
}: {
  label: string;
  value: string;
  tint?: string;
  labelTint?: string;
  divider?: boolean;
}) {
  return (
    <View style={[styles.macroPill, divider && styles.macroPillDivider]}>
      <Text style={[styles.macroLabel, labelTint ? {color: labelTint} : null]}>
        {label}
      </Text>
      <Text style={[styles.macroValue, tint ? {color: tint} : null]}>{value}</Text>
    </View>
  );
}

function TierOption({
  selected,
  onPress,
  accent,
  title,
  subtitle,
  price,
  badge,
}: {
  selected: boolean;
  onPress: () => void;
  accent: string;
  title: string;
  subtitle: string;
  price: string;
  badge?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tierOption,
        {borderColor: selected ? accent : COLORS.slate100},
        selected && styles.tierOptionSelected,
      ]}>
      <View style={styles.tierOptionLeft}>
        <View style={[styles.radioOuter, {borderColor: selected ? accent : COLORS.slate300}]}>
          {selected ? <View style={[styles.radioInner, {backgroundColor: accent}]} /> : null}
        </View>
        <View style={styles.tierOptionCopy}>
          <View style={styles.tierTitleRow}>
            <Text style={styles.tierTitle}>{title}</Text>
            {badge ? (
              <View style={styles.tierBadge}>
                <Text style={styles.tierBadgeText}>{badge}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.tierSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Text style={styles.tierPrice}>{price}</Text>
    </Pressable>
  );
}

const COLORS = {
  white: '#FFFFFF',
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  emerald700: '#047857',
  emerald600: '#059669',
  emerald500: '#10B981',
  emerald400: '#34D399',
  orange700: '#C2410C',
  orange600: '#EA580C',
  orange500: '#F97316',
  blue700: '#1D4ED8',
  blue600: '#2563EB',
  blue500: '#3B82F6',
  indigo500: '#6366F1',
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 16,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.slate100,
    overflow: 'hidden',
  },
  imageWrap: {height: 192, width: '100%', backgroundColor: COLORS.slate100},
  image: {width: '100%', height: '100%'},
  trustSeal: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  trustSealText: {fontSize: 9, color: COLORS.white, fontWeight: '800', letterSpacing: 0.5},
  protocolBadgeRow: {position: 'absolute', bottom: 12, left: 12, flexDirection: 'row'},
  protocolBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8},
  protocolBadgeText: {fontSize: 9, fontWeight: '700', color: COLORS.white, letterSpacing: 0.8},

  body: {padding: 16},
  titleRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6},
  title: {flex: 1, fontSize: 14, fontWeight: '800', color: COLORS.slate900, paddingRight: 16, lineHeight: 18},
  price: {fontSize: 14, fontWeight: '900', color: COLORS.slate900},
  description: {fontSize: 12, color: COLORS.slate500, lineHeight: 18, marginBottom: 12},

  macroRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: COLORS.slate50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.slate100,
    marginBottom: 16,
  },
  macroPill: {flex: 1, alignItems: 'center'},
  macroPillDivider: {borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: COLORS.slate200},
  macroLabel: {fontSize: 8, fontWeight: '700', textTransform: 'uppercase', color: COLORS.slate400},
  macroValue: {fontSize: 12, fontWeight: '900', color: COLORS.slate800, marginTop: 2},

  tierBlock: {
    marginBottom: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.slate100,
    gap: 8,
  },
  tierHeading: {fontSize: 10, fontWeight: '900', letterSpacing: 1, color: COLORS.slate500, marginBottom: 2},
  tierOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: COLORS.white,
  },
  tierOptionSelected: {backgroundColor: COLORS.slate50},
  tierOptionLeft: {flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1},
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {width: 8, height: 8, borderRadius: 4},
  tierOptionCopy: {flex: 1},
  tierTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap'},
  tierTitle: {fontSize: 12, fontWeight: '700', color: COLORS.slate800},
  tierBadge: {backgroundColor: COLORS.emerald500, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4},
  tierBadgeText: {color: COLORS.white, fontSize: 8, fontWeight: '900', letterSpacing: 0.5},
  tierSubtitle: {fontSize: 10, color: COLORS.slate500, marginTop: 2},
  tierPrice: {fontSize: 12, fontWeight: '800', color: COLORS.slate800, marginLeft: 8},

  cta: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDefault: {backgroundColor: COLORS.slate900},
  ctaAdded: {backgroundColor: COLORS.emerald500},
  ctaAddedRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  ctaText: {fontSize: 12, fontWeight: '900', letterSpacing: 1, color: COLORS.white, textAlign: 'center'},
});
