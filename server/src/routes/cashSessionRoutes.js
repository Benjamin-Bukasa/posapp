const express = require("express");
const auth = require("../middlewares/auth");
const cashSessionController = require("../controllers/cashSessionController");

const router = express.Router();

router.get("/current", auth, cashSessionController.getCurrent);
router.get("/", auth, cashSessionController.list);
router.get("/:id", auth, cashSessionController.getById);
router.post("/open", auth, cashSessionController.open);
router.post("/:id/close", auth, cashSessionController.close);
router.post("/:id/movements", auth, cashSessionController.addMovement);

module.exports = router;
