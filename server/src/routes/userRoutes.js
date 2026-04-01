const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const userController = require("../controllers/userController");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/", auth, requirePermission("users.read"), userController.listUsers);
router.get(
  "/template",
  auth,
  requirePermission("users.create"),
  userController.downloadUsersTemplate
);
router.post(
  "/import",
  auth,
  requirePermission("users.create"),
  upload.single("file"),
  userController.importUsers
);
router.get("/me/preferences", auth, userController.getMyPreferences);
router.patch("/me/preferences", auth, userController.updateMyPreferences);
router.get("/:id", auth, userController.getUser);
router.post(
  "/",
  auth,
  requirePermission("users.create"),
  userController.createUser
);
router.patch(
  "/:id",
  auth,
  requirePermission("users.update"),
  userController.updateUser
);
router.patch(
  "/:id/permissions",
  auth,
  requirePermission("users.update"),
  userController.updateUserPermissions
);
router.delete(
  "/:id",
  auth,
  requirePermission("users.delete"),
  userController.deactivateUser
);

module.exports = router;
