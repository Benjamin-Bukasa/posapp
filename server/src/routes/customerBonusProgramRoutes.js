const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/customerBonusProgramController");

const router = express.Router();

router.get("/current", auth, requirePermission("settings.read"), controller.getCurrentProgram);
router.get("/", auth, requirePermission("settings.read"), controller.listPrograms);
router.get("/:id", auth, requirePermission("settings.read"), controller.getProgram);
router.post("/", auth, requirePermission("settings.create"), controller.createProgram);
router.post(
  "/:id/set-current",
  auth,
  requirePermission("settings.update"),
  controller.setCurrentProgram,
);
router.patch("/:id", auth, requirePermission("settings.update"), controller.updateProgram);
router.delete("/:id", auth, requirePermission("settings.delete"), controller.deleteProgram);

module.exports = router;
