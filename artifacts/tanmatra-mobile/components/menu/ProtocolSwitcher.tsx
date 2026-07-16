import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

export type ProtocolType = 'Wellness' | 'Performance' | 'Clinical';

interface ProtocolSwitcherProps {
  onProtocolChange: (protocol: ProtocolType) => void;
  activeProtocol: ProtocolType;
}

const COLORS = {
  white: '#FFFFFF',
  slate700: '#334155',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  emerald800: '#065F46',
  emerald600: '#059669',
  emerald500: '#10B981',
  orange800: '#9A3412',
  orange500: '#F97316',
  blue800: '#1E40AF',
  blue500: '#3B82F6',
} as const;

const TABS: {key: ProtocolType; caption: string}[] = [
  {key: 'Wellness', caption: 'Longevity & Gut'},
  {key: 'Performance', caption: 'Recovery & Build'},
  {key: 'Clinical', caption: 'Therapeutic Care'},
];

const ACCENT: Record<ProtocolType, {border: string; bg: string; text: string}> = {
  Wellness: {border: COLORS.emerald500, bg: 'rgba(16,185,129,0.08)', text: COLORS.emerald800},
  Performance: {border: COLORS.orange500, bg: 'rgba(249,115,22,0.08)', text: COLORS.orange800},
  Clinical: {border: COLORS.blue500, bg: 'rgba(59,130,246,0.08)', text: COLORS.blue800},
};

/**
 * Protocol tab switcher. Re-ported from a web/DOM prototype into real React
 * Native — the previous version used web DOM elements (<div>/<button>/<span>)
 * with Tailwind classNames, which are not valid RN components and would throw
 * if rendered. Not yet wired into the app's navigation (see index.tsx); this
 * is a valid, ready-to-use RN component.
 */
export const ProtocolSwitcher: React.FC<ProtocolSwitcherProps> = ({
  onProtocolChange,
  activeProtocol,
}) => {
  const [isCalibrating, setIsCalibrating] = useState(false);

  useEffect(() => {
    // Visible "menu recalibrating" feedback on protocol change.
    setIsCalibrating(true);
    const timer = setTimeout(() => setIsCalibrating(false), 850);
    return () => clearTimeout(timer);
  }, [activeProtocol]);

  const activeAccent = ACCENT[activeProtocol];

  return (
    <View style={styles.container}>
      <View style={styles.tabsRow}>
        {TABS.map(({key, caption}) => {
          const isActive = activeProtocol === key;
          const accent = ACCENT[key];
          return (
            <Pressable
              key={key}
              onPress={() => onProtocolChange(key)}
              accessibilityRole="tab"
              accessibilityState={{selected: isActive}}
              style={[
                styles.tab,
                {
                  borderColor: isActive ? accent.border : COLORS.slate200,
                  backgroundColor: isActive ? accent.bg : COLORS.white,
                },
              ]}>
              <Text style={[styles.tabTitle, {color: isActive ? accent.text : COLORS.slate700}]}>
                {key}
              </Text>
              <Text style={styles.tabCaption}>{caption}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.syncBar}>
        <View style={styles.syncLeft}>
          <View style={styles.syncDot} />
          <Text style={styles.syncText}>Garmin & Apple Watch Sync Active</Text>
        </View>
        <View style={styles.syncBadge}>
          <Text style={styles.syncBadgeText}>Biometrics Updated: 11:00 AM</Text>
        </View>
      </View>

      {isCalibrating ? (
        <View style={[styles.calibrationBar, {backgroundColor: activeAccent.border}]} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slate100,
    paddingVertical: 12,
  },
  tabsRow: {flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, gap: 8},
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTitle: {fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase'},
  tabCaption: {fontSize: 8, color: COLORS.slate400, fontWeight: '600', marginTop: 2},

  syncBar: {
    marginTop: 10,
    marginHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.slate50,
    borderWidth: 1,
    borderColor: 'rgba(226,232,240,0.5)',
    borderRadius: 8,
  },
  syncLeft: {flexDirection: 'row', alignItems: 'center', gap: 6},
  syncDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.emerald500},
  syncText: {fontSize: 9, color: COLORS.slate500, fontWeight: '700', letterSpacing: 0.5},
  syncBadge: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  syncBadgeText: {fontSize: 9, color: COLORS.emerald600, fontWeight: '700'},

  calibrationBar: {height: 4, width: '100%', marginTop: 8},
});
