import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { CircleAlert, Package, Search } from "lucide-react-native";
import AppButton from "../../components/ui/AppButton";
import AppScreen from "../../components/ui/AppScreen";
import {
  arriveDelivery,
  completeDelivery,
  listAssignments,
  startDelivery,
} from "../../services/api/driver";
import { useThemePalette } from "../../theme/useThemePalette";
import { normalizeAppError } from "../../utils/errorHandling";

const FILTERS = ["ALL", "ASSIGNED", "IN_TRANSIT", "ARRIVED", "DELIVERED"];

const STATUS_META = {
  ASSIGNED: { label: "Assigned", color: "#FF8C42" },
  IN_TRANSIT: { label: "Transit", color: "#FF5B2E" },
  ARRIVED: { label: "Arrived", color: "#111111" },
  DELIVERED: { label: "Delivered", color: "#2F9E74" },
  PENDING: { label: "Pending", color: "#B68A74" },
  CANCELED: { label: "Canceled", color: "#C64A4A" },
};

const STATUS_STEPS = ["ASSIGNED", "IN_TRANSIT", "ARRIVED", "DELIVERED"];

const ShipmentProgress = ({ status, palette }) => {
  const activeIndex = Math.max(0, STATUS_STEPS.indexOf(status));

  return (
    <View style={styles.progressRow}>
      {STATUS_STEPS.map((step, index) => (
        <View key={step} style={styles.progressSegment}>
          <View
            style={[
              styles.progressDot,
              {
                backgroundColor: index <= activeIndex ? palette.secondaryValue : "#EAD6CB",
              },
            ]}
          />
          {index < STATUS_STEPS.length - 1 ? (
            <View
              style={[
                styles.progressLine,
                {
                  backgroundColor: index < activeIndex ? palette.secondaryValue : "#EAD6CB",
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
};

const AssignmentsScreen = () => {
  const palette = useThemePalette();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [activeFilter, setActiveFilter] = useState("ALL");

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAssignments();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(normalizeAppError(requestError, "Impossible de charger les missions."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const filteredAssignments = useMemo(() => {
    if (activeFilter === "ALL") return assignments;
    return assignments.filter((assignment) => assignment.status === activeFilter);
  }, [activeFilter, assignments]);

  const getAction = (assignment) => {
    if (assignment.status === "PENDING" || assignment.status === "ASSIGNED") {
      return { label: "Start trip", run: startDelivery };
    }
    if (assignment.status === "IN_TRANSIT") {
      return { label: "Mark arrived", run: arriveDelivery };
    }
    if (assignment.status === "ARRIVED") {
      return { label: "Complete", run: completeDelivery };
    }
    return null;
  };

  const handleAction = async (assignment) => {
    const action = getAction(assignment);
    if (!action) return;

    setActionId(assignment.id);
    setError(null);
    try {
      await action.run(assignment.id);
      await loadAssignments();
    } catch (requestError) {
      setError(
        normalizeAppError(requestError, "Impossible de mettre a jour la livraison."),
      );
    } finally {
      setActionId(null);
    }
  };

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.eyebrow, { color: palette.textSecondary }]}>
            My Shipping
          </Text>
          <Text style={[styles.title, { color: palette.textPrimary }]}>
            Shipment Overview
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.searchShell,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Search size={18} color={palette.textSecondary} />
        <Text style={[styles.searchText, { color: palette.textSecondary }]}>
          Search shipment
        </Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((filter) => {
          const selected = activeFilter === filter;
          return (
            <Pressable
              key={filter}
              onPress={() => setActiveFilter(filter)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selected ? palette.tabBar : palette.card,
                  borderColor: selected ? palette.tabBar : palette.border,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? "#FFFFFF" : palette.textSecondary,
                  fontWeight: "700",
                  fontSize: 12,
                }}
              >
                {filter === "ALL" ? "All Package" : STATUS_META[filter]?.label || filter}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={palette.secondaryValue} />
          <Text style={{ color: palette.textSecondary }}>Loading shipment feed...</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={{ color: palette.danger }}>
          {error.message}
          {error.hint ? ` ${error.hint}` : ""}
        </Text>
      ) : null}

      <View style={styles.list}>
        {filteredAssignments.map((assignment) => {
          const meta = STATUS_META[assignment.status] || STATUS_META.PENDING;
          const action = getAction(assignment);

          return (
            <View
              key={assignment.id}
              style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, { backgroundColor: palette.softCard }]}>
                  <Package size={22} color={palette.secondaryValue} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardId, { color: palette.textPrimary }]}>
                    ID: {assignment.id}
                  </Text>
                  <Text style={[styles.cardName, { color: palette.textSecondary }]}>
                    {assignment.customerName || "Client"}
                  </Text>
                </View>
                <Text style={[styles.cardStatus, { color: meta.color }]}>{meta.label}</Text>
              </View>

              <ShipmentProgress status={assignment.status} palette={palette} />

              <View style={styles.routeGrid}>
                <View style={styles.routeCol}>
                  <Text style={[styles.routeLabel, { color: palette.textSecondary }]}>From</Text>
                  <Text style={[styles.routeValue, { color: palette.textPrimary }]}>
                    {assignment.store?.name || "POSapp Hub"}
                  </Text>
                </View>
                <View style={styles.routeColRight}>
                  <Text style={[styles.routeLabel, { color: palette.textSecondary }]}>To</Text>
                  <Text style={[styles.routeValue, { color: palette.textPrimary }]}>
                    {assignment.customerName || "Client"}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <CircleAlert size={14} color={palette.textSecondary} />
                <Text style={[styles.metaText, { color: palette.textSecondary }]}>
                  {assignment.deliveryAddress || "Adresse de livraison non renseignee"}
                </Text>
              </View>

              <View style={styles.footerRow}>
                <Text style={[styles.totalText, { color: palette.textPrimary }]}>
                  {assignment.order
                    ? `${assignment.order.total} ${assignment.order.currencyCode}`
                    : "Montant indisponible"}
                </Text>
                {action ? (
                  <View style={styles.actionButtonWrap}>
                    <AppButton
                      label={action.label}
                      onPress={() => handleAction(assignment)}
                      loading={actionId === assignment.id}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

        {!loading && !filteredAssignments.length ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: palette.textPrimary }]}>
              No shipment for this filter
            </Text>
            <Text style={[styles.emptyText, { color: palette.textSecondary }]}>
              The next assigned delivery will appear here.
            </Text>
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 12,
  },
  title: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "800",
  },
  searchShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  searchText: {
    fontSize: 14,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  filterChip: {
    borderWidth: 0.5,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  list: {
    gap: 14,
  },
  card: {
    borderRadius: 20,
    borderWidth: 0.5,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
  },
  cardId: {
    fontSize: 17,
    fontWeight: "800",
  },
  cardName: {
    marginTop: 4,
    fontSize: 13,
  },
  cardStatus: {
    fontSize: 12,
    fontWeight: "800",
  },
  progressRow: {
    flexDirection: "row",
    marginTop: 18,
    alignItems: "center",
  },
  progressSegment: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  progressLine: {
    flex: 1,
    height: 4,
    marginHorizontal: 6,
    borderRadius: 999,
  },
  routeGrid: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  routeCol: {
    flex: 1,
  },
  routeColRight: {
    flex: 1,
    alignItems: "flex-end",
  },
  routeLabel: {
    fontSize: 12,
  },
  routeValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: "700",
  },
  metaRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
  },
  footerRow: {
    marginTop: 16,
    gap: 12,
  },
  totalText: {
    fontSize: 15,
    fontWeight: "800",
  },
  actionButtonWrap: {
    marginTop: 2,
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 0.5,
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default AssignmentsScreen;
