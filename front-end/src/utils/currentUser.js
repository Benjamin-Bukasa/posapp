const DEFAULT_USER = {
  name: "Aline Mukendi",
  store: "Depot Central",
};

const pickString = (...values) =>
  values.find((value) => typeof value === "string" && value.trim());

const normalizeUser = (user) => {
  const name = pickString(
    user?.name,
    user?.fullName,
    user?.username,
    [user?.firstName, user?.lastName].filter(Boolean).join(" "),
    user?.email,
    user?.profile?.name,
    user?.user?.name
  );
  const store = pickString(
    user?.store,
    user?.boutique,
    user?.shop,
    user?.branch,
    user?.pharmacy,
    user?.pharmacyName,
    user?.storeName,
    user?.stock?.store
  );

  return {
    name: name?.trim() || DEFAULT_USER.name,
    store: store?.trim() || DEFAULT_USER.store,
  };
};

export const getCurrentUser = () => {
  if (typeof window === "undefined") return DEFAULT_USER;

  const rawUser =
    window.localStorage.getItem("user") ||
    window.localStorage.getItem("currentUser") ||
    window.localStorage.getItem("profile");

  if (rawUser) {
    try {
      return normalizeUser(JSON.parse(rawUser));
    } catch (error) {
      // ignore malformed storage, fallback below
    }
  }

  const rawName =
    window.localStorage.getItem("username") ||
    window.localStorage.getItem("name");
  const rawStore =
    window.localStorage.getItem("store") ||
    window.localStorage.getItem("boutique");

  if (rawName || rawStore) {
    return {
      name: rawName?.trim() || DEFAULT_USER.name,
      store: rawStore?.trim() || DEFAULT_USER.store,
    };
  }

  return DEFAULT_USER;
};
