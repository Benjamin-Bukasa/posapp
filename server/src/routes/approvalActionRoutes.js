const express = require("express");
const controller = require("../controllers/approvalActionController");

const router = express.Router();

router.get("/:token", controller.executeApprovalAction);

module.exports = router;
