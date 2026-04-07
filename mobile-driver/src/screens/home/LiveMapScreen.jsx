import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { ArrowLeft, EllipsisVertical, Phone, ScanSearch } from "lucide-react-native";
import AppScreen from "../../components/ui/AppScreen";
import {
  getCurrentAssignment,
  postDriverLocation,
} from "../../services/api/driver";
import { useThemePalette } from "../../theme/useThemePalette";
import { normalizeAppError } from "../../utils/errorHandling";

const KINSHASA_REGION = {
  latitude: -4.325,
  longitude: 15.322,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const STATUS_META = {
  PENDING: { label: "Pending", color: "#B68A74" },
  ASSIGNED: { label: "Assigned", color: "#FF8C42" },
  IN_TRANSIT: { label: "Transit", color: "#FF5B2E" },
  ARRIVED: { label: "Arrived", color: "#111111" },
  DELIVERED: { label: "Delivered", color: "#2F9E74" },
};

const STAGES = ["ASSIGNED", "IN_TRANSIT", "ARRIVED", "DELIVERED"];

const StatusProgress = ({ status }) => {
  const activeIndex = Math.max(0, STAGES.indexOf(status));

  return (
    <View style={styles.statusProgressRow}>
      {STAGES.map((stage, index) => (
        <View key={stage} style={styles.statusSegment}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: index <= activeIndex ? "#FF5B2E" : "#5C5C61" },
            ]}
          />
          {index < STAGES.length - 1 ? (
            <View
              style={[
                styles.statusLine,
                { backgroundColor: index < activeIndex ? "#FF5B2E" : "#5C5C61" },
              ]}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
};

const LiveMapScreen = () => {
  const palette = useThemePalette();
  const [permissionStatus, setPermissionStatus] = useState("loading");
  const [driverPosition, setDriverPosition] = useState(null);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [locationError, setLocationError] = useState(null);

  useEffect(() => {
    const requestPermission = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPermissionStatus(status);

        const assignment = await getCurrentAssignment();
        setCurrentAssignment(assignment || null);

        if (status === "granted") {
          const current = await Location.getCurrentPositionAsync({});
          const nextPosition = {
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          };
          setDriverPosition(nextPosition);

          await postDriverLocation({
            deliveryId: assignment?.id || null,
            latitude: nextPosition.latitude,
            longitude: nextPosition.longitude,
            accuracy: current.coords.accuracy || null,
          });
        }
      } catch (error) {
        setLocationError(
          normalizeAppError(error, "Impossible de synchroniser la position."),
        );
      }
    };

    requestPermission();
  }, []);

  const region = useMemo(() => {
    if (driverPosition) {
      return {
        ...driverPosition,
        latitudeDelta: 0.045,
        longitudeDelta: 0.045,
      };
    }

    if (currentAssignment?.customerLatitude && currentAssignment?.customerLongitude) {
      return {
        latitude: currentAssignment.customerLatitude,
        longitude: currentAssignment.customerLongitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      };
    }

    return KINSHASA_REGION;
  }, [currentAssignment, driverPosition]);

  const routeCoordinates =
    driverPosition && currentAssignment?.customerLatitude && currentAssignment?.customerLongitude
      ? [
          driverPosition,
          {
            latitude: currentAssignment.customerLatitude,
            longitude: currentAssignment.customerLongitude,
          },
        ]
      : [];

  const statusMeta = STATUS_META[currentAssignment?.status] || STATUS_META.PENDING;

  return (
    <AppScreen scroll={false}>
      <View style={styles.container}>
        <View style={styles.mapShell}>
          <MapView style={StyleSheet.absoluteFillObject} initialRegion={region} region={region}>
            {driverPosition ? (
              <Marker coordinate={driverPosition} title="Driver" pinColor="#171717" />
            ) : null}

            {currentAssignment?.customerLatitude && currentAssignment?.customerLongitude ? (
              <Marker
                coordinate={{
                  latitude: currentAssignment.customerLatitude,
                  longitude: currentAssignment.customerLongitude,
                }}
                title={currentAssignment.customerName || "Client"}
                description={currentAssignment.deliveryAddress || "Adresse de livraison"}
                pinColor="#FF5B2E"
              />
            ) : null}

            {routeCoordinates.length === 2 ? (
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#171717"
                strokeWidth={5}
                lineDashPattern={[1]}
              />
            ) : null}
          </MapView>

          <View style={styles.headerOverlay}>
            <Pressable style={styles.headerButton}>
              <ArrowLeft size={18} color="#171717" />
            </Pressable>
            <Text style={styles.headerTitle}>Location Tracking</Text>
            <Pressable style={styles.headerButton}>
              <EllipsisVertical size={18} color="#171717" />
            </Pressable>
          </View>

          <View style={[styles.bottomPanel, { backgroundColor: palette.mapPanel }]}>
            {permissionStatus === "loading" ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" />
                <Text style={styles.panelBodyText}>Synchronisation de la carte...</Text>
              </View>
            ) : locationError ? (
              <Text style={styles.panelBodyText}>
                {locationError.message}
                {locationError.hint ? ` ${locationError.hint}` : ""}
              </Text>
            ) : currentAssignment ? (
              <>
                <View style={styles.panelTop}>
                  <View>
                    <Text style={styles.panelLabel}>Booking ID</Text>
                    <Text style={styles.panelTitle}>{currentAssignment.id}</Text>
                  </View>
                  <View style={styles.statusPill}>
                    <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
                      {statusMeta.label}
                    </Text>
                  </View>
                </View>

                <StatusProgress status={currentAssignment.status} />

                <View style={styles.panelRouteRow}>
                  <View>
                    <Text style={styles.panelLabel}>Current</Text>
                    <Text style={styles.panelBodyText}>
                      {currentAssignment.store?.name || "POSapp Hub"}
                    </Text>
                  </View>
                  <View style={styles.panelRouteRight}>
                    <Text style={styles.panelLabel}>Estimated</Text>
                    <Text style={styles.panelBodyText}>
                      {currentAssignment.customerName || "Client"}
                    </Text>
                  </View>
                </View>

                <View style={styles.panelInfoCard}>
                  <View style={styles.panelInfoCol}>
                    <Text style={styles.panelLabel}>Customer</Text>
                    <Text style={styles.panelBodyText}>
                      {currentAssignment.customerName || "Client"}
                    </Text>
                  </View>
                  <View style={styles.panelInfoColRight}>
                    <Text style={styles.panelLabel}>Amount</Text>
                    <Text style={styles.panelBodyText}>
                      {currentAssignment.order
                        ? `${currentAssignment.order.total} ${currentAssignment.order.currencyCode}`
                        : "--"}
                    </Text>
                  </View>
                </View>

                <View style={styles.panelFooter}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarText}>
                      {(currentAssignment.customerName || "C").slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.footerTextWrap}>
                    <Text style={styles.footerName}>
                      {currentAssignment.customerName || "Client"}
                    </Text>
                    <Text style={styles.footerRole}>Customer</Text>
                  </View>
                  <Pressable style={[styles.footerAction, { backgroundColor: "#FF5B2E" }]}>
                    <Phone size={18} color="#FFFFFF" />
                  </Pressable>
                  <Pressable style={[styles.footerAction, { backgroundColor: "#FFFFFF" }]}>
                    <ScanSearch size={18} color="#171717" />
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={styles.panelBodyText}>
                Aucune mission active pour afficher le tracking en temps reel.
              </Text>
            )}
          </View>
        </View>
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mapShell: {
    flex: 1,
    borderRadius: 34,
    overflow: "hidden",
    backgroundColor: "#EFE6DE",
  },
  headerOverlay: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#171717",
  },
  bottomPanel: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 16,
    borderRadius: 28,
    padding: 18,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  panelTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelLabel: {
    fontSize: 11,
    color: "#9FA1AA",
    textTransform: "uppercase",
  },
  panelTitle: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  statusPill: {
    borderRadius: 999,
    backgroundColor: "#26262B",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  statusProgressRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  statusSegment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusLine: {
    flex: 1,
    height: 4,
    borderRadius: 999,
    marginHorizontal: 6,
  },
  panelRouteRow: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
  },
  panelRouteRight: {
    alignItems: "flex-end",
  },
  panelBodyText: {
    marginTop: 6,
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
  },
  panelInfoCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#222227",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  panelInfoCol: {
    flex: 1,
  },
  panelInfoColRight: {
    alignItems: "flex-end",
  },
  panelFooter: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF2EA",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#171717",
    fontWeight: "800",
    fontSize: 16,
  },
  footerTextWrap: {
    flex: 1,
  },
  footerName: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  footerRole: {
    marginTop: 2,
    color: "#9FA1AA",
    fontSize: 12,
  },
  footerAction: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default LiveMapScreen;
