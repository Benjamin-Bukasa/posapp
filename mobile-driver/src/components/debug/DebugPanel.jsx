import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import useDebugStore from "../../stores/debugStore";
import { getApiBaseUrl } from "../../utils/errorHandling";

const formatDetails = (details) => {
  if (!details) {
    return null;
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2);
  } catch (_error) {
    return String(details);
  }
};

const DebugPanel = () => {
  const [visible, setVisible] = useState(false);
  const logs = useDebugStore((state) => state.logs);
  const clearLogs = useDebugStore((state) => state.clearLogs);

  const envSummary = useMemo(
    () => ({
      apiUrl: getApiBaseUrl(),
      mode: process.env.NODE_ENV || "development",
      hasExpoApiUrl: Boolean(process.env.EXPO_PUBLIC_API_URL),
    }),
    [],
  );

  return (
    <>
      <Pressable style={styles.fab} onPress={() => setVisible(true)}>
        <Text style={styles.fabText}>Debug</Text>
      </Pressable>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Diagnostic mobile</Text>
                <Text style={styles.subtitle}>
                  Erreurs API, rendu et configuration locale
                </Text>
              </View>
              <Pressable onPress={() => setVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeText}>Fermer</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Environnement</Text>
                <Text style={styles.metaLine}>API: {envSummary.apiUrl}</Text>
                <Text style={styles.metaLine}>Mode: {envSummary.mode}</Text>
                <Text style={styles.metaLine}>
                  EXPO_PUBLIC_API_URL: {envSummary.hasExpoApiUrl ? "defini" : "absent"}
                </Text>
              </View>

              <View style={styles.actionsRow}>
                <Pressable onPress={clearLogs} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Vider les logs</Text>
                </Pressable>
              </View>

              {logs.length === 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Aucun log pour le moment</Text>
                  <Text style={styles.emptyText}>
                    Si quelque chose plante ou si une requete echoue, tu le verras ici.
                  </Text>
                </View>
              ) : (
                logs.map((log) => (
                  <View key={log.id} style={styles.card}>
                    <Text style={styles.level}>
                      [{log.level.toUpperCase()}] {log.scope}
                    </Text>
                    <Text style={styles.message}>{log.message}</Text>
                    <Text style={styles.timestamp}>{log.createdAt}</Text>
                    {formatDetails(log.details) ? (
                      <Text style={styles.details}>{formatDetails(log.details)}</Text>
                    ) : null}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    bottom: 28,
    zIndex: 1000,
    borderRadius: 999,
    backgroundColor: "#171321",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#2f2841",
  },
  fabText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(12, 9, 17, 0.48)",
  },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#f4f1f7",
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#171321",
  },
  subtitle: {
    marginTop: 4,
    color: "#5f5973",
    fontSize: 13,
  },
  closeButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#171321",
    alignSelf: "flex-start",
  },
  closeText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  content: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#ffffff",
  },
  cardTitle: {
    color: "#171321",
    fontWeight: "700",
    fontSize: 15,
  },
  metaLine: {
    marginTop: 6,
    color: "#413b55",
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  secondaryButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#e4deec",
  },
  secondaryButtonText: {
    color: "#171321",
    fontWeight: "600",
  },
  emptyText: {
    marginTop: 8,
    color: "#5f5973",
    fontSize: 13,
  },
  level: {
    color: "#6a2ae6",
    fontSize: 12,
    fontWeight: "700",
  },
  message: {
    marginTop: 6,
    color: "#171321",
    fontSize: 15,
    fontWeight: "600",
  },
  timestamp: {
    marginTop: 4,
    color: "#7a748e",
    fontSize: 12,
  },
  details: {
    marginTop: 10,
    color: "#413b55",
    fontSize: 12,
  },
});

export default DebugPanel;
