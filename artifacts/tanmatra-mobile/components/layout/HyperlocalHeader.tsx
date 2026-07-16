import {Feather} from '@expo/vector-icons';
import React, {useState} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/**
 * Hyperlocal delivery-address header. Re-ported from a web/DOM prototype into
 * real React Native primitives — the previous version used web DOM elements
 * (<header>/<div>/<svg>) with Tailwind classNames, which are not valid RN
 * components and would throw if rendered. Not yet wired into the app's
 * navigation (see index.tsx); this is a valid, ready-to-use RN component.
 */
export const HyperlocalHeader: React.FC = () => {
  const [address, setAddress] = useState('Sector 62, Noida NCR');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const handleSaveAddress = () => {
    if (searchQuery.trim() || postalCode.trim()) {
      setAddress(searchQuery || `PIN: ${postalCode}, Noida`);
      setIsModalOpen(false);
    }
  };

  const useCurrentLocation = () => {
    setAddress('Sector 62, Noida NCR');
    setIsModalOpen(false);
  };

  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="map-pin" size={18} color={COLORS.emerald400} />
          <View>
            <Text style={styles.deliveringTo}>DELIVERING TO</Text>
            <Pressable
              onPress={() => setIsModalOpen(true)}
              style={styles.addressButton}
              accessibilityRole="button"
              accessibilityLabel="Change delivery address">
              <Text style={styles.addressText}>{address}</Text>
              <Feather name="chevron-down" size={14} color={COLORS.emerald400} />
            </Pressable>
          </View>
        </View>
        <View style={styles.etaPill}>
          <View style={styles.etaDot} />
          <Text style={styles.etaText}>32 MINS</Text>
        </View>
      </View>

      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleWrap}>
                <Text style={styles.modalTitle}>Verify Your Delivery Location</Text>
                <Text style={styles.modalSubtitle}>
                  Tanmatra delivers fresh in 25–40 mins from ISO 22000 sterile
                  cloud kitchens. Verify your sector below.
                </Text>
              </View>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close">
                <Feather name="x" size={20} color={COLORS.slate400} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Enter Delivery Address / Sector</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="e.g. Sector 62, Noida"
              placeholderTextColor={COLORS.slate400}
              style={styles.input}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.fieldLabel}>Postal PIN Code</Text>
            <TextInput
              value={postalCode}
              onChangeText={(t) => setPostalCode(t.replace(/\D/g, ''))}
              placeholder="e.g. 201301"
              placeholderTextColor={COLORS.slate400}
              keyboardType="number-pad"
              maxLength={6}
              style={[styles.input, styles.inputPin]}
            />

            <Pressable onPress={useCurrentLocation} style={styles.gpsButton}>
              <Feather name="navigation" size={16} color={COLORS.emerald500} />
              <Text style={styles.gpsButtonText}>Use Live Device GPS Location</Text>
            </Pressable>

            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => setIsModalOpen(false)}
                style={[styles.actionButton, styles.cancelButton]}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveAddress}
                style={[styles.actionButton, styles.confirmButton]}>
                <Text style={styles.confirmButtonText}>Confirm Location</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const COLORS = {
  slate900: '#0F172A',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  white: '#FFFFFF',
  emerald500: '#10B981',
  emerald400: '#34D399',
  overlay: 'rgba(2,6,23,0.8)',
};

const styles = StyleSheet.create({
  header: {
    width: '100%',
    backgroundColor: COLORS.slate900,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(16,185,129,0.2)',
  },
  headerLeft: {flexDirection: 'row', alignItems: 'center', gap: 8},
  deliveringTo: {
    fontSize: 9,
    color: COLORS.slate400,
    fontWeight: '700',
    letterSpacing: 1,
  },
  addressButton: {flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1},
  addressText: {fontSize: 12, fontWeight: '600', color: COLORS.slate100},
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  etaDot: {width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.emerald400},
  etaText: {fontSize: 10, fontWeight: '700', color: COLORS.emerald400},

  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
  },
  modalHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16},
  modalTitleWrap: {flex: 1, paddingRight: 8},
  modalTitle: {fontSize: 18, fontWeight: '800', color: COLORS.slate900},
  modalSubtitle: {fontSize: 12, color: COLORS.slate500, marginTop: 4, lineHeight: 17},
  closeButton: {padding: 4},
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: COLORS.slate500,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.slate200,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.slate900,
    backgroundColor: COLORS.slate50,
  },
  inputPin: {fontWeight: '700', letterSpacing: 4},
  dividerRow: {flexDirection: 'row', alignItems: 'center', marginVertical: 14},
  dividerLine: {flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.slate200},
  dividerText: {
    marginHorizontal: 16,
    fontSize: 10,
    color: COLORS.slate400,
    fontWeight: '700',
    letterSpacing: 1,
  },
  gpsButton: {
    marginTop: 16,
    width: '100%',
    paddingVertical: 12,
    backgroundColor: COLORS.slate100,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gpsButtonText: {fontSize: 12, fontWeight: '700', color: COLORS.slate700},
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.slate100,
  },
  actionButton: {flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center'},
  cancelButton: {backgroundColor: 'transparent'},
  cancelButtonText: {fontSize: 12, fontWeight: '700', color: COLORS.slate600},
  confirmButton: {backgroundColor: COLORS.slate900},
  confirmButtonText: {fontSize: 12, fontWeight: '700', color: COLORS.white},
});
