require("dotenv").config({ quiet: true });

const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const storeRoutes = require("./routes/storeRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");
const unitRoutes = require("./routes/unitRoutes");
const productRoutes = require("./routes/productRoutes");
const supplierRoutes = require("./routes/supplierRoutes");
const customerRoutes = require("./routes/customerRoutes");
const productCategoryRoutes = require("./routes/productCategoryRoutes");
const productCollectionRoutes = require("./routes/productCollectionRoutes");
const productFamilyRoutes = require("./routes/productFamilyRoutes");
const productSubFamilyRoutes = require("./routes/productSubFamilyRoutes");
const storageZoneRoutes = require("./routes/storageZoneRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const inventoryMovementRoutes = require("./routes/inventoryMovementRoutes");
const approvalFlowRoutes = require("./routes/approvalFlowRoutes");
const approvalActionRoutes = require("./routes/approvalActionRoutes");
const supplyRequestRoutes = require("./routes/supplyRequestRoutes");
const transferRoutes = require("./routes/transferRoutes");
const purchaseRequestRoutes = require("./routes/purchaseRequestRoutes");
const purchaseOrderRoutes = require("./routes/purchaseOrderRoutes");
const deliveryNoteRoutes = require("./routes/deliveryNoteRoutes");
const stockEntryRoutes = require("./routes/stockEntryRoutes");
const supplierReturnRoutes = require("./routes/supplierReturnRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const cashSessionRoutes = require("./routes/cashSessionRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const reportRoutes = require("./routes/reportRoutes");
const currencySettingsRoutes = require("./routes/currencySettingsRoutes");
const receiptSettingsRoutes = require("./routes/receiptSettingsRoutes");
const customerBonusProgramRoutes = require("./routes/customerBonusProgramRoutes");
const taxRateRoutes = require("./routes/taxRateRoutes");
const permissionProfileRoutes = require("./routes/permissionProfileRoutes");
const mobileDriverRoutes = require("./routes/mobileDriverRoutes");
const { ensureProductExtendedFields } = require("./controllers/productController");
const { startSubscriptionCron } = require("./services/subscriptionCron");
const { initSocket } = require("./socket");
const prisma = require("./config/prisma");
const { normalizeManagementUnits } = require("./utils/normalizeManagementUnits");
const { ensureCustomerBonusProgramsTable } = require("./utils/customerBonusProgramStore");
const { ensureTaxRatesTable } = require("./utils/taxRateStore");
const { ensurePermissionProfileTables } = require("./utils/permissionProfileStore");
const { ensureTenantCurrencyColumns } = require("./utils/currencySettings");
const { ensureCashSessionTables } = require("./utils/cashSessionStore");
const { ensureInventorySessionTables } = require("./utils/inventorySessionStore");
const { ensureUserPreferenceTable } = require("./utils/userPreferenceStore");
const { ensureReceiptSettingsTable } = require("./utils/receiptSettingsStore");
const { ensureDocumentApprovalTable } = require("./utils/documentApprovalStore");
const { ensureApprovalActionTokenTable } = require("./utils/approvalActionTokenStore");
const { ensureSupplierReturnTables } = require("./controllers/supplierReturnController");
const { getEmailDebugInfo } = require("./services/notificationService");

const app = express();
const server = http.createServer(app);
const isBootVerbose = ["1", "true", "yes", "on"].includes(
  String(process.env.BOOT_VERBOSE || "").trim().toLowerCase()
);
let bootstrapState = {
  ready: false,
  lastError: null,
};

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  if (!bootstrapState.ready) {
    return res.status(503).json({
      status: "degraded",
      database: "unavailable",
      error: bootstrapState.lastError,
    });
  }

  return res.json({ status: "ok" });
});

app.use("/api/approval-actions", approvalActionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/products", productRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/product-categories", productCategoryRoutes);
app.use("/api/product-collections", productCollectionRoutes);
app.use("/api/product-families", productFamilyRoutes);
app.use("/api/product-subfamilies", productSubFamilyRoutes);
app.use("/api/storage-zones", storageZoneRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/inventory-movements", inventoryMovementRoutes);
app.use("/api/approval-flows", approvalFlowRoutes);
app.use("/api/supply-requests", supplyRequestRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/purchase-requests", purchaseRequestRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);
app.use("/api/delivery-notes", deliveryNoteRoutes);
app.use("/api/stock-entries", stockEntryRoutes);
app.use("/api/supplier-returns", supplierReturnRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/cash-sessions", cashSessionRoutes);
app.use("/api/admin-dashboard", adminDashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/currency-settings", currencySettingsRoutes);
app.use("/api/receipt-settings", receiptSettingsRoutes);
app.use("/api/customer-bonus-programs", customerBonusProgramRoutes);
app.use("/api/tax-rates", taxRateRoutes);
app.use("/api/permission-profiles", permissionProfileRoutes);
app.use("/api/mobile/driver", mobileDriverRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error." });
});

const port = process.env.PORT || 5000;
initSocket(server);

const wait = (delayMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

const getDatabaseDebugInfo = () => {
  const rawUrl = process.env.DATABASE_URL || "";

  if (!rawUrl) {
    return { configured: false };
  }

  try {
    const parsed = new URL(rawUrl);
    return {
      configured: true,
      host: parsed.hostname,
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, "") || null,
      sslmode: parsed.searchParams.get("sslmode") || null,
    };
  } catch (error) {
    return {
      configured: true,
      invalidUrl: true,
    };
  }
};

const bootDebug = (...args) => {
  if (isBootVerbose) {
    console.log(...args);
  }
};

const formatEmailBootInfo = () => {
  const info = getEmailDebugInfo();
  return info.configured ? `${info.provider} configured` : "email not configured";
};

const formatDatabaseBootInfo = () => {
  const info = getDatabaseDebugInfo();

  if (!info.configured) {
    return "database not configured";
  }

  if (info.invalidUrl) {
    return "database URL invalid";
  }

  return `${info.database || "unknown"}@${info.host}:${info.port}`;
};

const toErrorMessage = (error) => {
  if (!error) {
    return "Unknown bootstrap error.";
  }

  return error.message || String(error);
};

const runWithRetry = async (label, task, { attempts = 5, delayMs = 5000 } = {}) => {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      console.error(
        `[BOOT] ${label} failed (attempt ${attempt}/${attempts}): ${toErrorMessage(error)}`
      );

      if (attempt < attempts) {
        await wait(delayMs);
      }
    }
  }

  throw lastError;
};

const bootstrap = async () => {
  bootDebug("[EMAIL][BOOT]", getEmailDebugInfo());
  bootDebug("[DB][BOOT]", getDatabaseDebugInfo());

  await runWithRetry(
    "Prisma connection",
    async () => {
      await prisma.$connect();
      await prisma.$queryRawUnsafe("SELECT 1");
    },
    { attempts: 5, delayMs: 4000 }
  );
  bootDebug("Database connection ready.");

  await ensureTenantCurrencyColumns(prisma);
  bootDebug("Currency settings ready.");

  await ensureProductExtendedFields();
  bootDebug("Product extended fields ready.");

  await ensureTaxRatesTable();
  bootDebug("Tax rates ready.");

  await ensureCustomerBonusProgramsTable();
  bootDebug("Customer bonus programs ready.");

  const managementSummary = await normalizeManagementUnits(prisma);
  if (
    isBootVerbose ||
    managementSummary.mergedUnits > 0 ||
    managementSummary.normalizedProducts > 0
  ) {
    console.log(
      `Management units normalized: ${managementSummary.mergedUnits} unit(s) merged, ${managementSummary.normalizedProducts} product(s) aligned.`,
    );
  }

  await ensurePermissionProfileTables();
  bootDebug("Permission profiles ready.");

  await ensureCashSessionTables();
  bootDebug("Cash sessions ready.");

  await ensureInventorySessionTables();
  bootDebug("Inventory sessions ready.");

  await ensureUserPreferenceTable();
  bootDebug("User preferences ready.");

  await ensureReceiptSettingsTable();
  bootDebug("Receipt settings ready.");

  await ensureDocumentApprovalTable();
  bootDebug("Document approvals ready.");

  await ensureApprovalActionTokenTable();
  bootDebug("Approval action tokens ready.");

  await ensureSupplierReturnTables();
  bootDebug("Supplier returns ready.");

  bootstrapState = {
    ready: true,
    lastError: null,
  };

  server.listen(port, () => {
    console.log(
      `Server running on port ${port} (${formatDatabaseBootInfo()}, ${formatEmailBootInfo()})`
    );
  });

  startSubscriptionCron();
};

bootstrap().catch((error) => {
  bootstrapState = {
    ready: false,
    lastError: toErrorMessage(error),
  };
  console.error("Unable to bootstrap server.", error);
  process.exit(1);
});
