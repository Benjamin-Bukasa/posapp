const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const seedUserEmail = "bukasabenjamin6@gmail.com";

const permissions = [
  { code: "SELL", label: "Vendre", description: "Acces caisse et ventes." },
  { code: "MANAGE_PRODUCTS", label: "Produits", description: "CRUD produits." },
  { code: "MANAGE_CUSTOMERS", label: "Clients", description: "CRUD clients." },
  { code: "MANAGE_ORDERS", label: "Commandes", description: "CRUD commandes." },
  { code: "MANAGE_STORES", label: "Vendeurs", description: "CRUD Vendeurs." },
  { code: "VIEW_REPORTS", label: "Rapports", description: "Acces rapports." },
];

const ensureTenant = async () => {
  const existing = await prisma.tenant.findFirst({
    where: { name: "Pharma Demo" },
  });
  if (existing) return existing;
  return prisma.tenant.create({ data: { name: "Pharma Demo" } });
};

const resolveSeedContext = async () => {
  const user = await prisma.user.findUnique({
    where: { email: seedUserEmail },
  });
  if (user?.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });
    if (tenant) return { tenant, user };
  }
  const tenant = await ensureTenant();
  return { tenant, user: null };
};

const findOrCreateCategory = async (tenantId, name) => {
  const existing = await prisma.productCategory.findFirst({
    where: { tenantId, name },
  });
  if (existing) return existing;
  return prisma.productCategory.create({ data: { tenantId, name } });
};

const findOrCreateFamily = async (tenantId, name) => {
  const existing = await prisma.productFamily.findFirst({
    where: { tenantId, name },
  });
  if (existing) return existing;
  return prisma.productFamily.create({ data: { tenantId, name } });
};

const findOrCreateUnit = async (tenantId, data) => {
  const existing = await prisma.unitOfMeasure.findFirst({
    where: { tenantId, name: data.name, type: data.type },
  });
  if (existing) return existing;
  return prisma.unitOfMeasure.create({ data: { tenantId, ...data } });
};

const findOrCreateStore = async (tenantId, data) => {
  const existing = await prisma.store.findFirst({
    where: { tenantId, name: data.name },
  });
  if (existing) return existing;
  return prisma.store.create({ data: { tenantId, ...data } });
};

const findOrCreateZone = async (tenantId, storeId, data) => {
  const existing = await prisma.storageZone.findFirst({
    where: { tenantId, storeId, name: data.name, zoneType: data.zoneType },
  });
  if (existing) return existing;
  return prisma.storageZone.create({ data: { tenantId, storeId, ...data } });
};

const run = async () => {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { label: permission.label, description: permission.description },
      create: permission,
    });
  }

  const { tenant, user } = await resolveSeedContext();
  const tenantId = tenant.id;

  const categoryMedicaments = await findOrCreateCategory(
    tenantId,
    "Medicaments"
  );
  const categoryParaVendeur = await findOrCreateCategory(
    tenantId,
    "ParaVendeur"
  );
  const familyGeneriques = await findOrCreateFamily(tenantId, "Generiques");

  const saleUnit = await findOrCreateUnit(tenantId, {
    name: "Boite",
    type: "SALE",
    symbol: "bx",
  });
  const stockUnit = await findOrCreateUnit(tenantId, {
    name: "Carton",
    type: "STOCK",
    symbol: "ctn",
  });
  const dosageUnit = await findOrCreateUnit(tenantId, {
    name: "mg",
    type: "DOSAGE",
    symbol: "mg",
  });

  const storeCentral = await findOrCreateStore(tenantId, {
    name: "Pharma Centrale",
    code: "STR001",
    city: "Kinshasa",
    country: "RDC",
  });
  const storeNord = await findOrCreateStore(tenantId, {
    name: "Pharma Nord",
    code: "STR002",
    city: "Kinshasa",
    country: "RDC",
  });

  const centralStockZone = await findOrCreateZone(tenantId, storeCentral.id, {
    name: "Magasin",
    zoneType: "STORE",
  });
  const centralCounterZone = await findOrCreateZone(tenantId, storeCentral.id, {
    name: "Caisse",
    zoneType: "COUNTER",
  });
  const northStockZone = await findOrCreateZone(tenantId, storeNord.id, {
    name: "Magasin",
    zoneType: "STORE",
  });

  const productSeeds = [
    {
      sku: "MED-001",
      name: "Paracetamol 500mg",
      description: "Antalgique et antipyretique",
      unitPrice: 1.5,
      categoryId: categoryMedicaments.id,
      familyId: familyGeneriques.id,
    },
    {
      sku: "MED-002",
      name: "Amoxicilline 500mg",
      description: "Antibiotique",
      unitPrice: 3.2,
      categoryId: categoryMedicaments.id,
      familyId: familyGeneriques.id,
    },
    {
      sku: "MED-003",
      name: "Ibuprofene 400mg",
      description: "Anti-inflammatoire",
      unitPrice: 2.4,
      categoryId: categoryMedicaments.id,
      familyId: familyGeneriques.id,
    },
    {
      sku: "PARA-001",
      name: "Gel Hydroalcoolique 250ml",
      description: "Hygiene des mains",
      unitPrice: 4.5,
      categoryId: categoryParaVendeur.id,
    },
    {
      sku: "PARA-002",
      name: "Vitamine C 1000mg",
      description: "Complement alimentaire",
      unitPrice: 5.0,
      categoryId: categoryParaVendeur.id,
    },
  ];

  const products = [];
  for (const seed of productSeeds) {
    const product = await prisma.product.upsert({
      where: { sku: seed.sku },
      update: {
        tenantId,
        name: seed.name,
        description: seed.description,
        unitPrice: seed.unitPrice,
        categoryId: seed.categoryId,
        familyId: seed.familyId,
        saleUnitId: saleUnit.id,
        stockUnitId: stockUnit.id,
        dosageUnitId: dosageUnit.id,
        isActive: true,
      },
      create: {
        tenantId,
        sku: seed.sku,
        name: seed.name,
        description: seed.description,
        unitPrice: seed.unitPrice,
        categoryId: seed.categoryId,
        familyId: seed.familyId,
        saleUnitId: saleUnit.id,
        stockUnitId: stockUnit.id,
        dosageUnitId: dosageUnit.id,
        isActive: true,
      },
    });
    products.push(product);
  }

  const inventorySeeds = [
    { store: storeCentral, zone: centralStockZone, factor: 1 },
    { store: storeNord, zone: northStockZone, factor: 0.6 },
  ];

  for (const product of products) {
    for (const seed of inventorySeeds) {
      const baseQty = 50 + Math.floor(Math.random() * 30);
      const quantity = Math.max(5, Math.round(baseQty * seed.factor));
      const minLevel = 10;
      await prisma.inventory.upsert({
        where: {
          storageZoneId_productId: {
            storageZoneId: seed.zone.id,
            productId: product.id,
          },
        },
        update: {
          quantity,
          minLevel,
          storeId: seed.store.id,
          tenantId,
        },
        create: {
          tenantId,
          storeId: seed.store.id,
          storageZoneId: seed.zone.id,
          productId: product.id,
          quantity,
          minLevel,
        },
      });
    }
  }

  await prisma.storageZone.updateMany({
    where: { id: centralCounterZone.id },
    data: { note: "Zone caisse" },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        storeId: storeCentral.id,
        defaultStorageZoneId: centralStockZone.id,
      },
    });
  }
};

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
