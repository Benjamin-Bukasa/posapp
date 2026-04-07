require("dotenv").config();

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
const currencySettingsRoutes = require("./routes/currencySettingsRoutes");
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
const { ensureDocumentApprovalTable } = require("./utils/documentApprovalStore");
const { ensureSupplierReturnTables } = require("./controllers/supplierReturnController");

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

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
app.use("/api/currency-settings", currencySettingsRoutes);
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

const bootstrap = async () => {
  await ensureTenantCurrencyColumns(prisma);
  console.log("Currency settings ready.");

  await ensureProductExtendedFields();
  console.log("Product extended fields ready.");

  await ensureTaxRatesTable();
  console.log("Tax rates ready.");

  await ensureCustomerBonusProgramsTable();
  console.log("Customer bonus programs ready.");

  const managementSummary = await normalizeManagementUnits(prisma);
  console.log(
    `Management units normalized: ${managementSummary.mergedUnits} unit(s) merged, ${managementSummary.normalizedProducts} product(s) aligned.`,
  );

  await ensurePermissionProfileTables();
  console.log("Permission profiles ready.");

  await ensureCashSessionTables();
  console.log("Cash sessions ready.");

  await ensureInventorySessionTables();
  console.log("Inventory sessions ready.");

  await ensureUserPreferenceTable();
  console.log("User preferences ready.");

  await ensureDocumentApprovalTable();
  console.log("Document approvals ready.");

  await ensureSupplierReturnTables();
  console.log("Supplier returns ready.");

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  startSubscriptionCron();
};

bootstrap().catch((error) => {
  console.error("Unable to bootstrap server.", error);
  process.exit(1);
});
