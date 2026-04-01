const crypto = require("node:crypto");
const prisma = require("../config/prisma");
const {
  parseListParams,
  buildMeta,
  buildDateRangeFilter,
} = require("../utils/listing");
const { sendExport } = require("../utils/exporter");
const {
  assignGeneratedDocumentCode,
  attachDocumentCodes,
} = require("../utils/documentCodeStore");
const {
  consumeInventoryLotsFefo,
  ensureInventoryLotTables,
  emitLotExpiryNotifications,
} = require("../utils/inventoryLotStore");
const {
  getDocumentApprovals,
  getDocumentApprovalMap,
  prepareDocumentApprovals,
  decideDocumentApproval,
  ensureDocumentApprovalTable,
} = require("../utils/documentApprovalStore");

const SUPPLIER_RETURN_DOCUMENT_TYPE = "SUPPLIER_RETURN";
const SUPPLIER_RETURN_FLOW_CODE = "SUPPLIER_RETURN";
const createId = () => crypto.randomUUID();

const escapeSqlValue = (value) => {
  if (value === null || value === undefined || value === "") return "NULL";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

let ensurePromise = null;

const ensureSupplierReturnTables = async () => {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "supplierReturns" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "code" TEXT NULL,
        "supplierId" TEXT NOT NULL,
        "storageZoneId" TEXT NOT NULL,
        "requestedById" TEXT NULL,
        "approvedById" TEXT NULL,
        "postedById" TEXT NULL,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "note" TEXT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "approvedAt" TIMESTAMPTZ NULL,
        "postedAt" TIMESTAMPTZ NULL,
        CONSTRAINT "supplierReturns_status_check" CHECK ("status" IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED')),
        CONSTRAINT "supplierReturns_supplier_fk" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT,
        CONSTRAINT "supplierReturns_zone_fk" FOREIGN KEY ("storageZoneId") REFERENCES "storageZone"("id") ON DELETE RESTRICT,
        CONSTRAINT "supplierReturns_requestedBy_fk" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "supplierReturns_approvedBy_fk" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "supplierReturns_postedBy_fk" FOREIGN KEY ("postedById") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "supplierReturnItems" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "supplierReturnId" TEXT NOT NULL,
        "productId" TEXT NOT NULL,
        "unitId" TEXT NULL,
        "quantity" DECIMAL(12,4) NOT NULL,
        "reason" TEXT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "supplierReturnItems_return_fk" FOREIGN KEY ("supplierReturnId") REFERENCES "supplierReturns"("id") ON DELETE CASCADE,
        CONSTRAINT "supplierReturnItems_product_fk" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT,
        CONSTRAINT "supplierReturnItems_unit_fk" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "supplierReturns_tenant_idx"
      ON "supplierReturns" ("tenantId", "createdAt")
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "supplierReturnItems_return_idx"
      ON "supplierReturnItems" ("supplierReturnId")
    `);
  })();

  try {
    await ensurePromise;
  } catch (error) {
    ensurePromise = null;
    throw error;
  }
};

const normalizeSupplierReturn = (row) => ({
  id: row.id,
  tenantId: row.tenantId,
  code: row.code || null,
  supplierId: row.supplierId,
  storageZoneId: row.storageZoneId,
  requestedById: row.requestedById || null,
  approvedById: row.approvedById || null,
  postedById: row.postedById || null,
  status: row.status,
  note: row.note || null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  approvedAt: row.approvedAt || null,
  postedAt: row.postedAt || null,
  supplier: row.supplierId
    ? { id: row.supplierId, name: row.supplierName || "" }
    : null,
  storageZone: row.storageZoneId
    ? { id: row.storageZoneId, name: row.storageZoneName || "" }
    : null,
  store: row.storeId ? { id: row.storeId, name: row.storeName || "" } : null,
  requestedBy: row.requestedById
    ? {
        id: row.requestedById,
        firstName: row.requestedByFirstName || "",
        lastName: row.requestedByLastName || "",
        email: row.requestedByEmail || "",
      }
    : null,
  approvedBy: row.approvedById
    ? {
        id: row.approvedById,
        firstName: row.approvedByFirstName || "",
        lastName: row.approvedByLastName || "",
        email: row.approvedByEmail || "",
      }
    : null,
  postedBy: row.postedById
    ? {
        id: row.postedById,
        firstName: row.postedByFirstName || "",
        lastName: row.postedByLastName || "",
        email: row.postedByEmail || "",
      }
    : null,
  itemsCount: Number(row.itemsCount || 0),
});

const normalizeSupplierReturnItem = (row) => ({
  id: row.id,
  supplierReturnId: row.supplierReturnId,
  productId: row.productId,
  unitId: row.unitId || null,
  quantity: Number(row.quantity || 0),
  reason: row.reason || null,
  product: row.productId
    ? {
        id: row.productId,
        name: row.productName || "",
        sku: row.productSku || "",
      }
    : null,
  unit: row.unitId ? { id: row.unitId, name: row.unitName || "" } : null,
});

const getBaseQuery = (whereSql) => `
  SELECT
    sr."id" AS "id",
    sr."tenantId" AS "tenantId",
    sr."code" AS "code",
    sr."supplierId" AS "supplierId",
    supplier."name" AS "supplierName",
    sr."storageZoneId" AS "storageZoneId",
    zone."name" AS "storageZoneName",
    zone."storeId" AS "storeId",
    store."name" AS "storeName",
    sr."requestedById" AS "requestedById",
    requester."firstName" AS "requestedByFirstName",
    requester."lastName" AS "requestedByLastName",
    requester."email" AS "requestedByEmail",
    sr."approvedById" AS "approvedById",
    approver."firstName" AS "approvedByFirstName",
    approver."lastName" AS "approvedByLastName",
    approver."email" AS "approvedByEmail",
    sr."postedById" AS "postedById",
    poster."firstName" AS "postedByFirstName",
    poster."lastName" AS "postedByLastName",
    poster."email" AS "postedByEmail",
    sr."status" AS "status",
    sr."note" AS "note",
    sr."createdAt" AS "createdAt",
    sr."updatedAt" AS "updatedAt",
    sr."approvedAt" AS "approvedAt",
    sr."postedAt" AS "postedAt",
    COUNT(item."id")::INTEGER AS "itemsCount"
  FROM "supplierReturns" sr
  INNER JOIN "suppliers" supplier ON supplier."id" = sr."supplierId"
  INNER JOIN "storageZone" zone ON zone."id" = sr."storageZoneId"
  LEFT JOIN "stores" store ON store."id" = zone."storeId"
  LEFT JOIN "users" requester ON requester."id" = sr."requestedById"
  LEFT JOIN "users" approver ON approver."id" = sr."approvedById"
  LEFT JOIN "users" poster ON poster."id" = sr."postedById"
  LEFT JOIN "supplierReturnItems" item ON item."supplierReturnId" = sr."id"
  WHERE ${whereSql}
  GROUP BY
    sr."id", supplier."id", zone."id", store."id",
    requester."id", approver."id", poster."id"
`;

const loadSupplierReturnItems = async (tenantId, supplierReturnId) => {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      item."id" AS "id",
      item."supplierReturnId" AS "supplierReturnId",
      item."productId" AS "productId",
      product."name" AS "productName",
      product."sku" AS "productSku",
      item."unitId" AS "unitId",
      unit."name" AS "unitName",
      item."quantity" AS "quantity",
      item."reason" AS "reason"
    FROM "supplierReturnItems" item
    INNER JOIN "products" product ON product."id" = item."productId"
    LEFT JOIN "units" unit ON unit."id" = item."unitId"
    WHERE item."tenantId" = ${escapeSqlValue(tenantId)}
      AND item."supplierReturnId" = ${escapeSqlValue(supplierReturnId)}
    ORDER BY item."createdAt" ASC
  `);
  return rows.map(normalizeSupplierReturnItem);
};

const getSupplierReturnById = async (tenantId, id) => {
  await ensureSupplierReturnTables();
  const rows = await prisma.$queryRawUnsafe(`
    ${getBaseQuery(`sr."tenantId" = ${escapeSqlValue(tenantId)} AND sr."id" = ${escapeSqlValue(id)}`)}
  `);
  if (!rows[0]) return null;
  const record = normalizeSupplierReturn(rows[0]);
  record.items = await loadSupplierReturnItems(tenantId, id);
  record.approvals = await getDocumentApprovals(tenantId, SUPPLIER_RETURN_DOCUMENT_TYPE, id);
  return record;
};

const canModifySupplierReturn = async (tenantId, record) => {
  if (record.status === "REJECTED") return true;
  if (record.status !== "DRAFT") return false;
  const approvals = await getDocumentApprovals(tenantId, SUPPLIER_RETURN_DOCUMENT_TYPE, record.id);
  return !approvals.length || approvals.some((item) => item.status === "REJECTED");
};

const listSupplierReturns = async (req, res) => {
  await ensureSupplierReturnTables();
  await ensureDocumentApprovalTable();
  const { status, supplierId, storageZoneId } = req.query || {};
  const { page, pageSize, paginate, search, exportType } = parseListParams(req.query);
  const createdAtFilter = buildDateRangeFilter(req.query, "createdAt");

  const clauses = [`sr."tenantId" = ${escapeSqlValue(req.user.tenantId)}`];
  if (status) clauses.push(`sr."status" = ${escapeSqlValue(status)}`);
  if (supplierId) clauses.push(`sr."supplierId" = ${escapeSqlValue(supplierId)}`);
  if (storageZoneId) clauses.push(`sr."storageZoneId" = ${escapeSqlValue(storageZoneId)}`);
  if (createdAtFilter.createdAt) {
    if (createdAtFilter.createdAt.gte) {
      clauses.push(`sr."createdAt" >= ${escapeSqlValue(createdAtFilter.createdAt.gte)}`);
    }
    if (createdAtFilter.createdAt.lte) {
      clauses.push(`sr."createdAt" <= ${escapeSqlValue(createdAtFilter.createdAt.lte)}`);
    }
  }
  if (search) {
    clauses.push(`(
      COALESCE(sr."code",'') ILIKE ${escapeSqlValue(`%${search}%`)}
      OR COALESCE(supplier."name",'') ILIKE ${escapeSqlValue(`%${search}%`)}
      OR COALESCE(zone."name",'') ILIKE ${escapeSqlValue(`%${search}%`)}
      OR COALESCE(store."name",'') ILIKE ${escapeSqlValue(`%${search}%`)}
    )`);
  }

  const baseRows = await prisma.$queryRawUnsafe(`
    ${getBaseQuery(clauses.join(" AND "))}
    ORDER BY sr."createdAt" DESC
  `);

  let records = await attachDocumentCodes(
    "supplierReturns",
    baseRows.map(normalizeSupplierReturn),
  );
  const approvalMap = await getDocumentApprovalMap(
    req.user.tenantId,
    SUPPLIER_RETURN_DOCUMENT_TYPE,
    records.map((item) => item.id),
  );
  records = records.map((item) => {
    const approvals = approvalMap.get(item.id) || [];
    return {
      ...item,
      rawStatus: item.status,
      status:
        approvals.some((approval) => approval.status === "REJECTED")
          ? "REJECTED"
          : item.status === "POSTED"
            ? "POSTED"
            : approvals.length && item.status !== "APPROVED"
              ? "SUBMITTED"
              : item.status,
      approvals,
    };
  });

  if (exportType) {
    return sendExport(
      res,
      records.map((item) => ({
        code: item.code || "",
        supplier: item.supplier?.name || "",
        zone: item.storageZone?.name || "",
        status: item.status,
        createdAt: item.createdAt,
      })),
      "supplier-returns",
      exportType,
    );
  }

  if (!paginate) {
    return res.json(records);
  }

  return res.json({
    data: records.slice((page - 1) * pageSize, page * pageSize),
    meta: buildMeta({ page, pageSize, total: records.length }),
  });
};

const createSupplierReturn = async (req, res) => {
  await ensureSupplierReturnTables();
  const { supplierId, storageZoneId, note, items, reference } = req.body || {};

  if (!supplierId || !storageZoneId) {
    return res.status(400).json({ message: "supplierId and storageZoneId are required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  const normalizedItems = items.map((item, index) => {
    const quantity = Number(item.quantity || 0);
    if (!item.productId || !Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error(`Ligne invalide ${index + 1}.`), { status: 400 });
    }
    return {
      productId: item.productId,
      unitId: item.unitId || null,
      quantity,
      reason: item.reason ? String(item.reason).trim() : null,
    };
  });

  try {
    const id = createId();
    await prisma.$executeRawUnsafe(`
      INSERT INTO "supplierReturns" (
        "id","tenantId","code","supplierId","storageZoneId","requestedById","status","note","createdAt","updatedAt"
      ) VALUES (
        ${escapeSqlValue(id)},
        ${escapeSqlValue(req.user.tenantId)},
        ${escapeSqlValue(reference || null)},
        ${escapeSqlValue(supplierId)},
        ${escapeSqlValue(storageZoneId)},
        ${escapeSqlValue(req.user.id)},
        'DRAFT',
        ${escapeSqlValue(note || null)},
        NOW(),
        NOW()
      )
    `);

    for (const item of normalizedItems) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "supplierReturnItems" (
          "id","tenantId","supplierReturnId","productId","unitId","quantity","reason","createdAt"
        ) VALUES (
          ${escapeSqlValue(createId())},
          ${escapeSqlValue(req.user.tenantId)},
          ${escapeSqlValue(id)},
          ${escapeSqlValue(item.productId)},
          ${escapeSqlValue(item.unitId)},
          ${escapeSqlValue(item.quantity)},
          ${escapeSqlValue(item.reason)},
          NOW()
        )
      `);
    }

    await assignGeneratedDocumentCode({
      tableName: "supplierReturns",
      tenantId: req.user.tenantId,
      id,
      prefix: "SRF",
      currentCode: reference,
    });

    return res.status(201).json(await getSupplierReturnById(req.user.tenantId, id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de creer ce retour fournisseur.",
    });
  }
};

const getSupplierReturn = async (req, res) => {
  const record = await getSupplierReturnById(req.user.tenantId, req.params.id);
  if (!record) {
    return res.status(404).json({ message: "Supplier return not found." });
  }
  return res.json(record);
};

const updateSupplierReturn = async (req, res) => {
  await ensureSupplierReturnTables();
  const record = await getSupplierReturnById(req.user.tenantId, req.params.id);
  if (!record) {
    return res.status(404).json({ message: "Supplier return not found." });
  }
  if (!(await canModifySupplierReturn(req.user.tenantId, record))) {
    return res.status(400).json({ message: "Only draft supplier returns can be edited." });
  }

  const { supplierId, storageZoneId, note, items, reference } = req.body || {};
  if (!supplierId || !storageZoneId) {
    return res.status(400).json({ message: "supplierId and storageZoneId are required." });
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: "items array required." });
  }

  const normalizedItems = items.map((item, index) => {
    const quantity = Number(item.quantity || 0);
    if (!item.productId || !Number.isFinite(quantity) || quantity <= 0) {
      throw Object.assign(new Error(`Ligne invalide ${index + 1}.`), { status: 400 });
    }
    return {
      productId: item.productId,
      unitId: item.unitId || null,
      quantity,
      reason: item.reason ? String(item.reason).trim() : null,
    };
  });

  await prisma.$executeRawUnsafe(`
    UPDATE "supplierReturns"
    SET
      "code" = ${escapeSqlValue(reference || record.code || null)},
      "supplierId" = ${escapeSqlValue(supplierId)},
      "storageZoneId" = ${escapeSqlValue(storageZoneId)},
      "note" = ${escapeSqlValue(note || null)},
      "status" = 'DRAFT',
      "updatedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(req.user.tenantId)}
      AND "id" = ${escapeSqlValue(record.id)}
  `);

  await prisma.$executeRawUnsafe(`
    DELETE FROM "supplierReturnItems"
    WHERE "tenantId" = ${escapeSqlValue(req.user.tenantId)}
      AND "supplierReturnId" = ${escapeSqlValue(record.id)}
  `);

  for (const item of normalizedItems) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "supplierReturnItems" (
        "id","tenantId","supplierReturnId","productId","unitId","quantity","reason","createdAt"
      ) VALUES (
        ${escapeSqlValue(createId())},
        ${escapeSqlValue(req.user.tenantId)},
        ${escapeSqlValue(record.id)},
        ${escapeSqlValue(item.productId)},
        ${escapeSqlValue(item.unitId)},
        ${escapeSqlValue(item.quantity)},
        ${escapeSqlValue(item.reason)},
        NOW()
      )
    `);
  }

  return res.json(await getSupplierReturnById(req.user.tenantId, record.id));
};

const deleteSupplierReturn = async (req, res) => {
  await ensureSupplierReturnTables();
  const record = await getSupplierReturnById(req.user.tenantId, req.params.id);
  if (!record) {
    return res.status(404).json({ message: "Supplier return not found." });
  }
  if (!(await canModifySupplierReturn(req.user.tenantId, record))) {
    return res.status(400).json({ message: "Only draft supplier returns can be deleted." });
  }
  await prisma.$executeRawUnsafe(`
    DELETE FROM "supplierReturns"
    WHERE "tenantId" = ${escapeSqlValue(req.user.tenantId)}
      AND "id" = ${escapeSqlValue(record.id)}
  `);
  return res.json({ message: "Supplier return deleted." });
};

const submitSupplierReturn = async (req, res) => {
  await ensureSupplierReturnTables();
  const record = await getSupplierReturnById(req.user.tenantId, req.params.id);
  if (!record) {
    return res.status(404).json({ message: "Supplier return not found." });
  }
  if (!["DRAFT", "REJECTED"].includes(record.status)) {
    return res.status(400).json({ message: "Only draft supplier returns can be submitted." });
  }

  const approvalSession = await prepareDocumentApprovals({
    tenantId: req.user.tenantId,
    documentType: SUPPLIER_RETURN_DOCUMENT_TYPE,
    documentId: record.id,
    flowCodes: [SUPPLIER_RETURN_FLOW_CODE],
  });

  const nextStatus = approvalSession.approvals.length ? "SUBMITTED" : "APPROVED";
  await prisma.$executeRawUnsafe(`
    UPDATE "supplierReturns"
    SET "status" = ${escapeSqlValue(nextStatus)}, "updatedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(req.user.tenantId)}
      AND "id" = ${escapeSqlValue(record.id)}
  `);

  return res.json(await getSupplierReturnById(req.user.tenantId, record.id));
};

const approveSupplierReturn = async (req, res) => {
  const record = await getSupplierReturnById(req.user.tenantId, req.params.id);
  if (!record) {
    return res.status(404).json({ message: "Supplier return not found." });
  }

  try {
    const decision = await decideDocumentApproval({
      tenantId: req.user.tenantId,
      documentType: SUPPLIER_RETURN_DOCUMENT_TYPE,
      documentId: record.id,
      user: req.user,
      decision: "APPROVED",
      note: req.body?.note || null,
    });

    if (decision.lifecycleStatus === "APPROVED") {
      await prisma.$executeRawUnsafe(`
        UPDATE "supplierReturns"
        SET
          "status" = 'APPROVED',
          "approvedById" = ${escapeSqlValue(req.user.id)},
          "approvedAt" = NOW(),
          "updatedAt" = NOW()
        WHERE "tenantId" = ${escapeSqlValue(req.user.tenantId)}
          AND "id" = ${escapeSqlValue(record.id)}
      `);
    }

    return res.json(await getSupplierReturnById(req.user.tenantId, record.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de valider ce retour fournisseur.",
    });
  }
};

const rejectSupplierReturn = async (req, res) => {
  const record = await getSupplierReturnById(req.user.tenantId, req.params.id);
  if (!record) {
    return res.status(404).json({ message: "Supplier return not found." });
  }

  try {
    await decideDocumentApproval({
      tenantId: req.user.tenantId,
      documentType: SUPPLIER_RETURN_DOCUMENT_TYPE,
      documentId: record.id,
      user: req.user,
      decision: "REJECTED",
      note: req.body?.note || null,
    });

    await prisma.$executeRawUnsafe(`
      UPDATE "supplierReturns"
      SET "status" = 'REJECTED', "updatedAt" = NOW()
      WHERE "tenantId" = ${escapeSqlValue(req.user.tenantId)}
        AND "id" = ${escapeSqlValue(record.id)}
    `);

    return res.json(await getSupplierReturnById(req.user.tenantId, record.id));
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Impossible de rejeter ce retour fournisseur.",
    });
  }
};

const postSupplierReturn = async (req, res) => {
  await ensureSupplierReturnTables();
  await ensureInventoryLotTables();
  const record = await getSupplierReturnById(req.user.tenantId, req.params.id);
  if (!record) {
    return res.status(404).json({ message: "Supplier return not found." });
  }
  if (record.status !== "APPROVED") {
    return res.status(400).json({ message: "Only approved supplier returns can be posted." });
  }
  if (!record.storageZoneId) {
    return res.status(400).json({ message: "Storage zone required." });
  }

  const storageZone = await prisma.storageZone.findUnique({ where: { id: record.storageZoneId } });
  if (!storageZone?.storeId) {
    return res.status(400).json({ message: "Invalid storage zone." });
  }

  for (const item of record.items || []) {
    const existingInventory = await prisma.inventory.findUnique({
      where: {
        storageZoneId_productId: {
          storageZoneId: record.storageZoneId,
          productId: item.productId,
        },
      },
    });
    if (!existingInventory || Number(existingInventory.quantity || 0) < Number(item.quantity || 0)) {
      return res.status(400).json({
        message: `Stock insuffisant pour ${item.product?.name || "ce produit"}.`,
      });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const item of record.items || []) {
      const quantity = Number(item.quantity || 0);
      await consumeInventoryLotsFefo(tx, {
        tenantId: req.user.tenantId,
        storeId: storageZone.storeId,
        storageZoneId: record.storageZoneId,
        productId: item.productId,
        quantity,
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId: req.user.tenantId,
          productId: item.productId,
          storageZoneId: record.storageZoneId,
          quantity,
          movementType: "OUT",
          sourceType: "DIRECT",
          sourceId: record.id,
          createdById: req.user.id,
        },
      });
    }
  });

  await prisma.$executeRawUnsafe(`
    UPDATE "supplierReturns"
    SET
      "status" = 'POSTED',
      "postedById" = ${escapeSqlValue(req.user.id)},
      "postedAt" = NOW(),
      "updatedAt" = NOW()
    WHERE "tenantId" = ${escapeSqlValue(req.user.tenantId)}
      AND "id" = ${escapeSqlValue(record.id)}
  `);

  await emitLotExpiryNotifications(req.user.tenantId);
  return res.json(await getSupplierReturnById(req.user.tenantId, record.id));
};

module.exports = {
  ensureSupplierReturnTables,
  listSupplierReturns,
  createSupplierReturn,
  getSupplierReturn,
  updateSupplierReturn,
  deleteSupplierReturn,
  submitSupplierReturn,
  approveSupplierReturn,
  rejectSupplierReturn,
  postSupplierReturn,
};
