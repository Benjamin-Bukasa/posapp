const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/taxRateController");

const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), controller.listAll);
router.get("/:id", auth, requirePermission("settings.read"), controller.getOne);
router.post("/", auth, requirePermission("settings.create"), controller.createOne);
router.patch("/:id", auth, requirePermission("settings.update"), controller.updateOne);
router.delete("/:id", auth, requirePermission("settings.delete"), controller.deleteOne);

module.exports = router;
