import apiClient from "./client";

export const listAssignments = async (params = {}) => {
  const response = await apiClient.get("/api/mobile/driver/assignments", {
    params,
  });
  return response.data;
};

export const getCurrentAssignment = async () => {
  const response = await apiClient.get("/api/mobile/driver/assignments/current");
  return response.data;
};

export const startDelivery = async (deliveryId) => {
  const response = await apiClient.patch(
    `/api/mobile/driver/deliveries/${deliveryId}/start`,
  );
  return response.data;
};

export const arriveDelivery = async (deliveryId) => {
  const response = await apiClient.patch(
    `/api/mobile/driver/deliveries/${deliveryId}/arrive`,
  );
  return response.data;
};

export const completeDelivery = async (deliveryId) => {
  const response = await apiClient.patch(
    `/api/mobile/driver/deliveries/${deliveryId}/complete`,
  );
  return response.data;
};

export const postDriverLocation = async (payload) => {
  const response = await apiClient.post("/api/mobile/driver/location", payload);
  return response.data;
};
