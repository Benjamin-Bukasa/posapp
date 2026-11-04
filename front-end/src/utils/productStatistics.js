// Use the same availability and stock labels as the tenant-scoped product API.
export const getProductStatistics = (products) => ({
  total: products.length,
  inStock: products.filter((product) => Number(product.quantity) > 0).length,
  lowStock: products.filter((product) => product.stock === "Faible").length,
  outOfStock: products.filter((product) => Number(product.quantity) <= 0).length,
});
