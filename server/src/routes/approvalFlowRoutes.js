const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const approvalFlowController = require("../controllers/approvalFlowController");

const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), approvalFlowController.listFlows);
router.post(
  "/",
  auth,
  requirePermission("settings.create"),
  approvalFlowController.createFlow
);
router.patch(
  "/:id",
  auth,
  requirePermission("settings.update"),
  approvalFlowController.updateFlow
);
router.delete(
  "/:id",
  auth,
  requirePermission("settings.delete"),
  approvalFlowController.deleteFlow
);

module.exports = router;
