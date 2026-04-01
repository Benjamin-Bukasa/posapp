# POSapp Server API Endpoints

Base URL: `http://localhost:5000`

Auth header for protected endpoints:
`Authorization: Bearer <accessToken>`

Common list query params (all list endpoints):
- `page` (number), `pageSize` (number)
- `sortBy` (field), `sortDir` (`asc` or `desc`)
- `search` (string)
- `export=csv|xlsx` (returns a file export)
- `createdFrom`, `createdTo` (ISO date range on `createdAt` by default)
If `page` or `pageSize` is provided, the response shape becomes:
```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0,
    "sortBy": "createdAt",
    "sortDir": "desc"
  }
}
```

---

## Health

**GET** `/api/health`

Response 200:
```json
{
  "status": "ok"
}
```

---

## Auth

**POST** `/api/auth/register`

Body:
```json
{
  "tenantName": "Pharma Centrale",
  "plan": "STARTER",
  "billingCycle": "MONTHLY",
  "email": "owner@pharma.com",
  "phone": "+243900000001",
  "sendVia": "email",
  "firstName": "Bernard",
  "lastName": "Kalala"
}
```

Response 201:
```json
{
  "tenantId": "clx123",
  "userId": "clx456",
  "message": "Account created. Temporary credentials sent."
}
```

---

**POST** `/api/auth/login`

Body:
```json
{
  "identifier": "owner@pharma.com",
  "password": "TempPass123",
  "rememberMe": true,
  "twoFactorCode": "123456"
}
```

Response 200:
```json
{
  "accessToken": "jwt_access",
  "refreshToken": "jwt_refresh",
  "user": {
    "id": "clx456",
    "tenantId": "clx123",
    "role": "SUPERADMIN",
    "email": "owner@pharma.com",
    "phone": "+243900000001"
  }
}
```

Possible response 401 (2FA required):
```json
{
  "message": "Two-factor code required.",
  "requiresTwoFactor": true
}
```

Possible response 403 (first login):
```json
{
  "message": "Password change required.",
  "requirePasswordChange": true
}
```

---

**POST** `/api/auth/refresh`

Body:
```json
{
  "refreshToken": "jwt_refresh"
}
```

Response 200:
```json
{
  "accessToken": "jwt_access",
  "refreshToken": "jwt_refresh_new"
}
```

---

**POST** `/api/auth/logout`

Body:
```json
{
  "refreshToken": "jwt_refresh"
}
```

Response 200:
```json
{
  "message": "Logged out."
}
```

---

**POST** `/api/auth/forgot-password`

Body:
```json
{
  "identifier": "owner@pharma.com",
  "sendVia": "email"
}
```

Response 200:
```json
{
  "message": "Reset instructions sent."
}
```

---

**POST** `/api/auth/reset-password`

Body:
```json
{
  "token": "reset_token",
  "newPassword": "NewStrongPass123"
}
```

Response 200:
```json
{
  "message": "Password reset successful."
}
```

---

**POST** `/api/auth/first-login/change-password`

Body:
```json
{
  "identifier": "owner@pharma.com",
  "tempPassword": "TempPass123",
  "newPassword": "NewStrongPass123"
}
```

Response 200:
```json
{
  "message": "Password updated."
}
```

---

**POST** `/api/auth/change-password` (Protected)

Body:
```json
{
  "oldPassword": "OldPass123",
  "newPassword": "NewStrongPass123"
}
```

Response 200:
```json
{
  "message": "Password updated."
}
```

---

**POST** `/api/auth/2fa/setup` (Protected)

Response 200:
```json
{
  "base32": "JBSWY3DPEHPK3PXP",
  "otpauthUrl": "otpauth://totp/POSapp:owner@pharma.com?secret=JBSWY3DPEHPK3PXP"
}
```

---

**POST** `/api/auth/2fa/verify` (Protected)

Body:
```json
{
  "token": "123456"
}
```

Response 200:
```json
{
  "message": "2FA enabled."
}
```

---

**POST** `/api/auth/2fa/disable` (Protected)

Body:
```json
{
  "token": "123456"
}
```

Response 200:
```json
{
  "message": "2FA disabled."
}
```

---

**POST** `/api/auth/google`

Body:
```json
{
  "idToken": "google_id_token",
  "tenantName": "Pharma Centrale",
  "plan": "BASIC",
  "billingCycle": "ANNUAL"
}
```

Response 200:
```json
{
  "accessToken": "jwt_access",
  "refreshToken": "jwt_refresh",
  "user": {
    "id": "clx456",
    "tenantId": "clx123",
    "role": "SUPERADMIN",
    "email": "owner@pharma.com"
  }
}
```

---

## Users

**POST** `/api/users` (Protected, role SUPERADMIN/ADMIN)

Body:
```json
{
  "email": "user@pharma.com",
  "phone": "+243900000002",
  "firstName": "Aline",
  "lastName": "Mukendi",
  "role": "USER",
  "sendVia": "sms",
  "permissions": ["SELL", "MANAGE_PRODUCTS"]
}
```

Response 201:
```json
{
  "id": "clx789",
  "email": "user@pharma.com",
  "phone": "+243900000002",
  "role": "USER"
}
```

**GET** `/api/users` (Protected, role SUPERADMIN/ADMIN)

**GET** `/api/users/:id` (Protected, role SUPERADMIN/ADMIN)

**PATCH** `/api/users/:id` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "firstName": "Aline",
  "lastName": "Mukendi",
  "role": "ADMIN",
  "storeId": "store_id",
  "defaultStorageZoneId": "zone_id",
  "isActive": true
}
```

**PATCH** `/api/users/:id/permissions` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "permissions": ["SELL", "MANAGE_PRODUCTS"]
}
```

**DELETE** `/api/users/:id` (Protected, role SUPERADMIN/ADMIN)

---

## Stores

**POST** `/api/stores` (Protected, role SUPERADMIN/ADMIN)

Body:
```json
{
  "name": "Pharma Gombe",
  "code": "PG-01",
  "addressLine": "12 Avenue Kasa-Vubu",
  "commune": "Gombe",
  "city": "Kinshasa",
  "country": "RDC"
}
```

Response 201:
```json
{
  "id": "clx999",
  "tenantId": "clx123",
  "name": "Pharma Gombe",
  "code": "PG-01",
  "addressLine": "12 Avenue Kasa-Vubu",
  "commune": "Gombe",
  "city": "Kinshasa",
  "country": "RDC",
  "createdAt": "2026-03-05T10:00:00.000Z",
  "updatedAt": "2026-03-05T10:00:00.000Z"
}
```

---

## Subscriptions

**POST** `/api/subscriptions/renew` (Protected, role SUPERADMIN/ADMIN)

Body:
```json
{
  "billingCycle": "ANNUAL"
}
```

Response 200:
```json
{
  "message": "Subscription renewed.",
  "subscription": {
    "id": "clxsub1",
    "tenantId": "clx123",
    "plan": "BASIC",
    "billingCycle": "ANNUAL",
    "price": 479.04,
    "status": "ACTIVE",
    "startedAt": "2026-03-05T10:00:00.000Z",
    "endsAt": "2027-03-05T10:00:00.000Z"
  }
}
```

---

**PATCH** `/api/subscriptions/reminders` (Protected, role SUPERADMIN/ADMIN)

Body:
```json
{
  "enabled": true
}
```

Response 200:
```json
{
  "message": "Reminders updated.",
  "remindersEnabled": true
}
```

---

## Units (Dosage / Vente / Gestion)

**POST** `/api/units` (Protected, role SUPERADMIN/ADMIN)

Body:
```json
{
  "name": "Plaquette",
  "type": "SALE",
  "symbol": "plq"
}
```

**GET** `/api/units` (Protected)

Optional query:
`/api/units?type=SALE`

---

## Products

**POST** `/api/products` (Protected, role SUPERADMIN/ADMIN)

Body:
```json
{
  "name": "Paracétamol 500mg",
  "sku": "PARA-500",
  "unitPrice": 0.2,
  "saleUnitId": "unit_sale_id",
  "stockUnitId": "unit_stock_id",
  "dosageUnitId": "unit_dosage_id",
  "conversions": [
    { "fromUnitId": "unit_stock_id", "toUnitId": "unit_sale_id", "factor": 100 }
  ],
  "components": [
    { "componentName": "Comprimé", "dosageUnitId": "unit_dosage_id", "quantity": 10 }
  ]
}
```

**GET** `/api/products` (Protected)
**GET** `/api/products/:id` (Protected)

**PATCH** `/api/products/:id` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "name": "Paracétamol 500mg",
  "unitPrice": 0.25,
  "isActive": true
}
```

**DELETE** `/api/products/:id` (Protected, role SUPERADMIN/ADMIN)

**POST** `/api/products/:id/components`
```json
{
  "components": [
    { "componentName": "Comprimé", "dosageUnitId": "unit_dosage_id", "quantity": 10 }
  ]
}
```

**GET** `/api/products/:id/components` (Protected)
**PATCH** `/api/products/:id/components/:componentId` (Protected, role SUPERADMIN/ADMIN)
**DELETE** `/api/products/:id/components/:componentId` (Protected, role SUPERADMIN/ADMIN)

**POST** `/api/products/:id/conversions`
```json
{
  "conversions": [
    { "fromUnitId": "unit_stock_id", "toUnitId": "unit_sale_id", "factor": 100 }
  ]
}
```

**GET** `/api/products/:id/conversions` (Protected)
**PATCH** `/api/products/:id/conversions/:conversionId` (Protected, role SUPERADMIN/ADMIN)
**DELETE** `/api/products/:id/conversions/:conversionId` (Protected, role SUPERADMIN/ADMIN)

**POST** `/api/products/import`
```json
{ "file": "<excel-file>" }
```

Format Excel (sheet `Products`):
Columns supported:
- `name`, `sku`, `description`, `unitPrice`
- `category`, `family`
- `saleUnit`, `stockUnit`, `dosageUnit`
- `conversionFromUnit`, `conversionToUnit`, `conversionFactor`

Optional sheet `Components`:
Columns supported:
- `productSku` or `productName`
- `componentSku` or `componentName`
- `dosageUnit`, `quantity`

---

## Suppliers

**POST** `/api/suppliers` (Protected, role SUPERADMIN/ADMIN)

Body:
```json
{
  "name": "MedSupply SARL",
  "email": "contact@medsupply.com",
  "phone": "+243900000010"
}
```

**GET** `/api/suppliers` (Protected)

---

## Product Categories

**GET** `/api/product-categories` (Protected)
**POST** `/api/product-categories` (Protected, role SUPERADMIN/ADMIN)
```json
{ "name": "Antalgique" }
```
**PATCH** `/api/product-categories/:id`
**DELETE** `/api/product-categories/:id`

---

## Product Families

**GET** `/api/product-families` (Protected)
**POST** `/api/product-families` (Protected, role SUPERADMIN/ADMIN)
```json
{ "name": "Paracétamol" }
```
**PATCH** `/api/product-families/:id`
**DELETE** `/api/product-families/:id`

---

## Storage Zones

**POST** `/api/storage-zones` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "name": "Entrepôt principal",
  "storeId": "store_id",
  "zoneType": "WAREHOUSE"
}
```

**GET** `/api/storage-zones` (Protected)
Optional query: `?storeId=...&zoneType=WAREHOUSE`

**PATCH** `/api/storage-zones/:id` (Protected, role SUPERADMIN/ADMIN)

**DELETE** `/api/storage-zones/:id` (Protected, role SUPERADMIN/ADMIN)

---

## Inventory

**GET** `/api/inventory` (Protected)
Optional query: `?storeId=...&storageZoneId=...&zoneType=COUNTER&productId=...`
Note: `createdFrom/createdTo` filter uses `updatedAt` for inventory.

**POST** `/api/inventory/adjust` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "storageZoneId": "zone_id",
  "productId": "prod_id",
  "quantity": 10,
  "mode": "INCREMENT"
}
```

**PATCH** `/api/inventory/:id/min-level` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "minLevel": 5
}
```

---

## Approval Flows

**POST** `/api/approval-flows` (Protected, role SUPERADMIN/ADMIN)

Body:
```json
{
  "code": "SUPPLY_REQUEST",
  "name": "Validation réquisition",
  "steps": [
    { "stepOrder": 1, "approverRole": "ADMIN" },
    { "stepOrder": 2, "approverRole": "SUPERADMIN" }
  ]
}
```

**GET** `/api/approval-flows` (Protected)

---

## Supply Requests (Réquisitions)

**POST** `/api/supply-requests` (Protected)

Body:
```json
{
  "title": "Réapprovisionnement caisse",
  "storeId": "store_id",
  "storageZoneId": "zone_id",
  "items": [
    { "productId": "prod_id", "unitId": "unit_sale_id", "quantity": 20 }
  ]
}
```

**POST** `/api/supply-requests/:id/submit`
**POST** `/api/supply-requests/:id/approve`
**POST** `/api/supply-requests/:id/reject`
**GET** `/api/supply-requests` (Protected)
Optional query: `?status=APPROVED&storeId=...`
**GET** `/api/supply-requests/:id` (Protected)

**POST** `/api/supply-requests/:id/transfer`
```json
{
  "fromZoneId": "warehouse_zone_id",
  "toZoneId": "counter_zone_id",
  "items": [
    { "productId": "prod_id", "unitId": "unit_stock_id", "quantity": 2 }
  ]
}
```

**POST** `/api/supply-requests/:id/purchase-request`
```json
{
  "title": "Achat urgent",
  "items": [
    { "productId": "prod_id", "unitId": "unit_stock_id", "quantity": 5 }
  ]
}
```

---

## Transfers (Transferts de stock)

**GET** `/api/transfers` (Protected)
Optional query: `?status=COMPLETED&fromStoreId=...&toStoreId=...`
**GET** `/api/transfers/:id` (Protected)

**POST** `/api/transfers` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "fromStoreId": "store_warehouse",
  "toStoreId": "store_counter",
  "fromZoneId": "zone_wh",
  "toZoneId": "zone_counter",
  "items": [
    { "productId": "prod_id", "unitId": "unit_stock_id", "quantity": 2 }
  ]
}
```

**POST** `/api/transfers/:id/complete`

---

## Purchase Requests (Demandes d'achat)

**GET** `/api/purchase-requests` (Protected)
Optional query: `?status=APPROVED&storeId=...`
**GET** `/api/purchase-requests/:id` (Protected)

**POST** `/api/purchase-requests` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "title": "Achat paracétamol",
  "supplyRequestId": "req_id",
  "items": [
    { "productId": "prod_id", "unitId": "unit_stock_id", "quantity": 5 }
  ]
}
```

**POST** `/api/purchase-requests/:id/submit`
**POST** `/api/purchase-requests/:id/approve`
**POST** `/api/purchase-requests/:id/reject`

---

## Purchase Orders (Bons de commande)

**GET** `/api/purchase-orders` (Protected)
Optional query: `?status=SENT&storeId=...&supplierId=...`
**GET** `/api/purchase-orders/:id` (Protected)

**POST** `/api/purchase-orders` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "storeId": "store_id",
  "supplierId": "supplier_id",
  "purchaseRequestId": "purchase_req_id",
  "items": [
    { "productId": "prod_id", "unitId": "unit_stock_id", "quantity": 5, "unitPrice": 20 }
  ]
}
```

**POST** `/api/purchase-orders/:id/send`

---

## Delivery Notes (Bons de livraison)

**GET** `/api/delivery-notes` (Protected)
Optional query: `?status=RECEIVED&supplierId=...&purchaseOrderId=...`

**POST** `/api/delivery-notes` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "supplierId": "supplier_id",
  "purchaseOrderId": "po_id",
  "items": [
    { "productId": "prod_id", "unitId": "unit_stock_id", "orderedQty": 5, "deliveredQty": 5 }
  ]
}
```

**POST** `/api/delivery-notes/:id/receive`

---

## Stock Entries (Entrées en stock)

**GET** `/api/stock-entries` (Protected)
Optional query: `?status=POSTED&sourceType=DIRECT&storeId=...&storageZoneId=...&createdById=...&approvedById=...&createdFrom=2026-03-01&createdTo=2026-03-31`

**POST** `/api/stock-entries` (Protected, role SUPERADMIN/ADMIN)
```json
{
  "sourceType": "DIRECT",
  "storageZoneId": "zone_id",
  "items": [
    { "productId": "prod_id", "unitId": "unit_stock_id", "quantity": 10, "unitCost": 20 }
  ]
}
```

**POST** `/api/stock-entries/:id/approve` (SUPERADMIN)
**POST** `/api/stock-entries/:id/post`

---

## Orders (Ventes / Commandes clients)

**GET** `/api/orders` (Protected)
Optional query: `?status=PAID&storeId=...&customerId=...`
**GET** `/api/orders/:id` (Protected)

---

## Payments (Paiements)

**GET** `/api/payments` (Protected)
Optional query: `?status=COMPLETED&method=CASH&orderId=...`
**GET** `/api/payments/:id` (Protected)
