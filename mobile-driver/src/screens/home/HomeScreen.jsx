import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Bell,
  MapPin,
  Package,
  Search,
  Truck,
} from "lucide-react-native";
import AppScreen from "../../components/ui/AppScreen";
import { getCurrentAssignment, listAssignments } from "../../services/api/driver";
import useAuthStore from "../../stores/authStore";
import { useThemePalette } from "../../theme/useThemePalette";
import { normalizeAppError } from "../../utils/errorHandling";

const STATUS_META = {
  PENDING: { label: "Pending", color: "#B68A74" },
  ASSIGNED: { label: "Transit", color: "#FF8C42" },
  IN_TRANSIT: { label: "Transit", color: "#FF5B2E" },
  ARRIVED: { label: "Arrived", color: "#171717" },
  DELIVERED: { label: "Delivered", color: "#2F9E74" },
  CANCELED: { label: "Canceled", color: "#C64A4A" },
};

const PROGRESS_STEPS = ["ASSIGNED", "IN_TRANSIT", "ARRIVED", "DELIVERED"];

const getStatusMeta = (status) => STATUS_META[status] || STATUS_META.PENDING;

const ProgressTrack = ({ status, palette }) => {
  const activeIndex = Math.max(0, PROGRESS_STEPS.indexOf(status));

  return (
    <View style={styles.progressTrack}>
      {PROGRESS_STEPS.map((step, index) => (
        <View key={step} style={styles.progressSegment}>
          <View
            style={[
              styles.progressDot,
              {
                backgroundColor:
                  index <= activeIndex ? palette.secondaryValue : "#ECD8CD",
              },
            ]}
          />
          {index < PROGRESS_STEPS.length - 1 ? (
            <View
              style={[
                styles.progressLine,
                {
                  backgroundColor:
                    index < activeIndex ? palette.secondaryValue : "#ECD8CD",
                },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
};

const FeatureCard = ({ title, icon: Icon, accent, palette }) => (
  <Pressable
    style={[
      styles.featureCard,
      {
        backgroundColor: palette.card,
        borderColor: palette.border,
      },
    ]}
  >
    <Text style={[styles.featureTitle, { color: palette.textPrimary }]}>{title}</Text>
    <View style={[styles.featureVisual, { backgroundColor: accent }]}>
      <Icon size={34} color="#FFFFFF" />
    </View>
  </Pressable>
);

const RecentRow = ({ assignment, palette }) => {
  const statusMeta = getStatusMeta(assignment.status);

  return (
    <View style={styles.recentRow}>
      <View style={[styles.recentThumb, { backgroundColor: palette.softCard }]}>
        <Package size={18} color={palette.primaryValue} />
      </View>

      <View style={styles.recentContent}>
        <View style={styles.recentTopLine}>
          <Text style={[styles.recentId, { color: palette.textPrimary }]}>
            ID: {assignment.id}
          </Text>
          <Text style={[styles.recentStatus, { color: statusMeta.color }]}>
            {statusMeta.label}
          </Text>
        </View>

        <Text style={[styles.recentSubtitle, { color: palette.textSecondary }]}>
          {assignment.customerName || "Client"}
        </Text>

        <View style={styles.miniRouteRow}>
          <Text numberOfLines={1} style={[styles.miniRouteText, { color: palette.textSecondary }]}>
            {assignment.store?.name || "POSapp Hub"}
          </Text>
          <Text numberOfLines={1} style={[styles.miniRouteText, styles.miniRouteRight, { color: palette.textSecondary }]}>
            {assignment.customerName || "Client"}
          </Text>
        </View>
      </View>

      <View style={[styles.recentBox, { backgroundColor: palette.softCard }]}>
        <Package size={20} color={palette.secondaryValue} />
      </View>
    </View>
  );
};

const HomeScreen = () => {
  const palette = useThemePalette();
  const user = useAuthStore((state) => state.user);
  const [assignments, setAssignments] = useState([]);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError(null);
      try {
        const [assignmentData, currentData] = await Promise.all([
          listAssignments(),
          getCurrentAssignment(),
        ]);

        if (!mounted) return;
        setAssignments(Array.isArray(assignmentData) ? assignmentData : []);
        setCurrentAssignment(currentData || null);
      } catch (requestError) {
        if (!mounted) return;
        setError(
          normalizeAppError(requestError, "Impossible de charger le tableau de bord."),
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  const priorityAssignment = currentAssignment || assignments[0] || null;
  const statusMeta = getStatusMeta(priorityAssignment?.status);

  const compactRoute = useMemo(() => {
    if (!priorityAssignment) return null;
    return {
      from: priorityAssignment.store?.name || user?.storeName || "POSapp Hub",
      to: priorityAssignment.customerName || "Client",
    };
  }, [priorityAssignment, user?.storeName]);

  return (
    <AppScreen>
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.topHint, { color: palette.textSecondary }]}>Delivery to</Text>
          <View style={styles.locationRow}>
            <MapPin size={14} color={palette.secondaryValue} />
            <Text style={[styles.locationText, { color: palette.textPrimary }]}>
              {user?.storeName || "POSapp Hub"}
            </Text>
          </View>
        </View>

        <Pressable style={[styles.notificationButton, { backgroundColor: palette.card }]}>
          <Bell size={18} color={palette.textPrimary} />
          <View style={[styles.notificationDot, { backgroundColor: palette.secondaryValue }]} />
        </Pressable>
      </View>

      <View
        style={[
          styles.searchBar,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}
      >
        <Search size={16} color={palette.textSecondary} />
        <Text style={[styles.searchPlaceholder, { color: palette.textSecondary }]}>
          Search
        </Text>
      </View>

      <View style={styles.featureRow}>
        <FeatureCard
          title="New Delivery"
          icon={Truck}
          accent={palette.secondaryValue}
          palette={palette}
        />
        <FeatureCard
          title="Track Package"
          icon={Package}
          accent={palette.primaryValue}
          palette={palette}
        />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: palette.textPrimary }]}>
          Current Shipment
        </Text>
        <Text style={[styles.sectionLink, { color: palette.textSecondary }]}>See All</Text>
      </View>

      <View
        style={[
          styles.currentCard,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
          },
        ]}
      >
        {loading ? (
          <View style={styles.feedbackRow}>
            <ActivityIndicator color={palette.secondaryValue} />
            <Text style={[styles.feedbackText, { color: palette.textSecondary }]}>
              Loading shipment...
            </Text>
          </View>
        ) : error ? (
          <Text style={[styles.feedbackText, { color: palette.danger }]}>
            {error.message}
            {error.hint ? ` ${error.hint}` : ""}
          </Text>
        ) : priorityAssignment ? (
          <>
            <View style={styles.currentHeader}>
              <View style={[styles.currentThumb, { backgroundColor: palette.softCard }]}>
                <Package size={18} color={palette.primaryValue} />
              </View>

              <View style={styles.currentTextWrap}>
                <View style={styles.currentTopLine}>
                  <Text style={[styles.currentId, { color: palette.textPrimary }]}>
                    ID: {priorityAssignment.id}
                  </Text>
                  <Text style={[styles.currentStatus, { color: statusMeta.color }]}>
                    {statusMeta.label}
                  </Text>
                </View>
                <Text style={[styles.currentSubtitle, { color: palette.textSecondary }]}>
                  {priorityAssignment.customerName || "Client"}
                </Text>
              </View>

              <View style={[styles.currentBox, { backgroundColor: palette.softCard }]}>
                <Package size={22} color={palette.secondaryValue} />
              </View>
            </View>

            <ProgressTrack status={priorityAssignment.status} palette={palette} />

            <View style={styles.currentRouteMeta}>
              <View>
                <Text style={[styles.routeMetaLabel, { color: palette.textSecondary }]}>
                  Start
                </Text>
                <Text style={[styles.routeMetaValue, { color: palette.textPrimary }]}>
                  {compactRoute?.from}
                </Text>
              </View>
              <View style={styles.routeMetaRight}>
                <Text style={[styles.routeMetaLabel, { color: palette.textSecondary }]}>
                  End
                </Text>
                <Text style={[styles.routeMetaValue, { color: palette.textPrimary }]}>
                  {compactRoute?.to}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={[styles.feedbackText, { color: palette.textSecondary }]}>
            Aucune mission assignee pour le moment.
          </Text>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: palette.textPrimary }]}>
          Recent Shipment
        </Text>
        <Text style={[styles.sectionLink, { color: palette.textSecondary }]}>See All</Text>
      </View>

      <View
        style={[
          styles.recentCard,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
          },
        ]}
      >
        {assignments.slice(0, 3).map((assignment) => (
          <RecentRow key={assignment.id} assignment={assignment} palette={palette} />
        ))}

        {!loading && !assignments.length ? (
          <Text style={[styles.feedbackText, { color: palette.textSecondary }]}>
            No recent shipment yet.
          </Text>
        ) : null}
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topHint: {
    fontSize: 11,
  },
  locationRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    fontSize: 15,
    fontWeight: "700",
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationDot: {
    position: "absolute",
    top: 9,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  searchPlaceholder: {
    fontSize: 14,
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
  },
  featureCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 120,
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  featureVisual: {
    alignSelf: "flex-end",
    width: 74,
    height: 74,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionLink: {
    fontSize: 11,
    fontWeight: "600",
  },
  currentCard: {
    borderRadius: 20,
    borderWidth: 0.5,
    padding: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  currentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  currentThumb: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  currentTextWrap: {
    flex: 1,
  },
  currentTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  currentId: {
    fontSize: 16,
    fontWeight: "800",
  },
  currentStatus: {
    fontSize: 11,
    fontWeight: "700",
  },
  currentSubtitle: {
    marginTop: 4,
    fontSize: 12,
  },
  currentBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  progressSegment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  progressLine: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    marginHorizontal: 6,
  },
  currentRouteMeta: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  routeMetaRight: {
    alignItems: "flex-end",
  },
  routeMetaLabel: {
    fontSize: 10,
  },
  routeMetaValue: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  recentCard: {
    borderRadius: 20,
    borderWidth: 0.5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  recentThumb: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  recentContent: {
    flex: 1,
  },
  recentTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  recentId: {
    fontSize: 15,
    fontWeight: "800",
  },
  recentStatus: {
    fontSize: 10,
    fontWeight: "700",
  },
  recentSubtitle: {
    marginTop: 3,
    fontSize: 11,
  },
  miniRouteRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  miniRouteText: {
    flex: 1,
    fontSize: 10,
  },
  miniRouteRight: {
    textAlign: "right",
  },
  recentBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default HomeScreen;
