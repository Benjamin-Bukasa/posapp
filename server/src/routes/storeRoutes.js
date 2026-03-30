const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const storeController = require("../controllers/storeController");

const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), storeController.listStores);
router.post(
  "/",
  auth,
  requirePermission("settings.create"),
  storeController.createStore
);
router.patch(
  "/:id",
  auth,
  requirePermission("settings.update"),
  storeController.updateStore
);
router.delete(
  "/:id",
  auth,
  requirePermission("settings.delete"),
  storeController.deleteStore
);

module.exports = router;
