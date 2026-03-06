import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch } from 'react-native';

const PrivacySettings = () => {
  const [activeProvider, setActiveProvider] = useState('sip-native');
  const [viewingKeysEnabled, setViewingKeysEnabled] = useState(true);

  const providers = [
    { id: 'sip-native', name: 'SIP Native', method: 'Stealth + Pedersen', status: 'Built-in' },
    { id: 'privacy-cash', name: 'Privacy Cash', method: 'Pool mixing + ZK', status: 'SDK' },
    { id: 'shadow-wire', name: 'ShadowWire', method: 'Bulletproofs', status: 'SDK' },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Privacy Provider</Text>
      <Text style={styles.subHeader}>Choose your privacy engine</Text>

      {providers.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[styles.card, activeProvider === p.id && styles.activeCard]}
          onPress={() => setActiveProvider(p.id)}
        >
          <View style={styles.cardInfo}>
            <Text style={styles.providerName}>{p.name}</Text>
            <Text style={styles.providerMethod}>{p.method}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{p.status}</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.divider} />

      <View style={styles.optionRow}>
        <View>
          <Text style={styles.optionTitle}>Compliance Viewing Keys</Text>
          <Text style={styles.optionDesc}>Generate keys for auditability</Text>
        </View>
        <Switch
          value={viewingKeysEnabled}
          onValueChange={setViewingKeysEnabled}
          trackColor={{ false: '#767577', true: '#4ade80' }}
        />
      </View>

      <TouchableOpacity style={styles.saveButton}>
        <Text style={styles.saveButtonText}>Apply Changes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 20 },
  header: { color: '#f8fafc', fontSize: 24, fontWeight: 'bold' },
  subHeader: { color: '#94a3b8', fontSize: 14, marginBottom: 20 },
  card: {
    backgroundColor: '#1e293b',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeCard: { borderColor: '#4ade80', backgroundColor: '#1e293b' },
  cardInfo: { flex: 1 },
  providerName: { color: '#f8fafc', fontSize: 16, fontWeight: '600' },
  providerMethod: { color: '#64748b', fontSize: 12 },
  badge: { backgroundColor: '#334155', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#94a3b8', fontSize: 10, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 20 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionTitle: { color: '#f8fafc', fontSize: 16, fontWeight: '500' },
  optionDesc: { color: '#64748b', fontSize: 12 },
  saveButton: { backgroundColor: '#4ade80', padding: 15, borderRadius: 12, marginTop: 30, alignItems: 'center' },
  saveButtonText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
});

export default PrivacySettings;
