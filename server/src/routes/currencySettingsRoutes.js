const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/currencySettingsController");

const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), controller.listCurrencySettings);
router.post(
  "/",
  auth,
  requirePermission("settings.create"),
  controller.createCurrency,
);
router.get("/conversions", auth, requirePermission("settings.read"), controller.listCurrencyConversions);
router.post(
  "/conversions",
  auth,
  requirePermission("settings.create"),
  controller.createCurrencyConversion,
);
router.get("/current", auth, requirePermission("settings.read"), controller.getCurrentCurrencySettings);
router.post(
  "/current",
  auth,
  requirePermission("settings.update"),
  controller.saveCurrencySettings,
);
router.patch(
  "/current",
  auth,
  requirePermission("settings.update"),
  controller.saveCurrencySettings,
);
router.get("/:id", auth, requirePermission("settings.read"), controller.getCurrencySettingsById);
router.get("/conversions/:id", auth, requirePermission("settings.read"), controller.getCurrencyConversionById);
router.patch(
  "/conversions/:id",
  auth,
  requirePermission("settings.update"),
  controller.updateCurrencyConversion,
);
router.delete(
  "/conversions/:id",
  auth,
  requirePermission("settings.delete"),
  controller.deleteCurrencyConversion,
);
router.patch(
  "/:id",
  auth,
  requirePermission("settings.update"),
  controller.updateCurrency,
);
router.delete(
  "/:id",
  auth,
  requirePermission("settings.delete"),
  controller.deleteCurrency,
);
router.post(
  "/:id/set-current",
  auth,
  requirePermission("settings.update"),
  controller.setCurrentCurrency,
);
router.post(
  "/:id/set-secondary",
  auth,
  requirePermission("settings.update"),
  controller.setSecondaryCurrency,
);
router.post(
  "/:id/unset-secondary",
  auth,
  requirePermission("settings.update"),
  controller.unsetSecondaryCurrency,
);

module.exports = router;
