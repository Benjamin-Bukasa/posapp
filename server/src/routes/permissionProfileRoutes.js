const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/permissionProfileController");

const router = express.Router();

router.get(
  "/catalog",
  auth,
  requirePermission("users.read", "users.create", "users.update"),
  controller.listCatalog,
);
router.get(
  "/",
  auth,
  requirePermission("users.read", "users.create", "users.update"),
  controller.listProfiles,
);
router.get(
  "/:id",
  auth,
  requirePermission("users.read", "users.create", "users.update"),
  controller.getProfile,
);
router.post(
  "/",
  auth,
  requirePermission("users.create", "users.update"),
  controller.createProfile,
);
router.patch(
  "/:id",
  auth,
  requirePermission("users.update"),
  controller.updateProfile,
);
router.delete(
  "/:id",
  auth,
  requirePermission("users.delete"),
  controller.deleteProfile,
);

module.exports = router;
