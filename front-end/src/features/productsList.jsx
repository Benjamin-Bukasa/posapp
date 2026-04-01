/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useMemo, useState } from "react";
import { EllipsisVertical, SquarePen, Trash, Eye } from "lucide-react";
import DataTable from "../components/ui/datatable";
import DropdownAction from "../components/ui/dropdownAction";
import Modal from "../components/ui/modal";
import Badge from "../components/ui/badge";
import useToastStore from "../stores/toastStore";
import { apiDelete } from "../services/apiClient";
import { useProductsData } from "../hooks/useProductsData";
import useSyncedQuerySearch from "../hooks/useSyncedQuerySearch";

const CATEGORY_AVATAR_MAP = {
  antalgique: [
    "https://images.pexels.com/photos/9742740/pexels-photo-9742740.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
    "https://images.pexels.com/photos/9742744/pexels-photo-9742744.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  antibiotique: [
    "https://images.pexels.com/photos/4210607/pexels-photo-4210607.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
    "https://images.pexels.com/photos/208512/pexels-photo-208512.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  "anti-inflammatoire": [
    "https://images.pexels.com/photos/3683086/pexels-photo-3683086.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  antihistaminique: [
    "https://images.pexels.com/photos/9742745/pexels-photo-9742745.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  "gastro-entérologie": [
    "https://images.pexels.com/photos/5207322/pexels-photo-5207322.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
    "https://images.pexels.com/photos/9742782/pexels-photo-9742782.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  respiratoire: [
    "https://images.pexels.com/photos/3923166/pexels-photo-3923166.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  diabète: [
    "https://images.pexels.com/photos/9742749/pexels-photo-9742749.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  cardiologie: [
    "https://images.pexels.com/photos/8015770/pexels-photo-8015770.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
    "https://images.pexels.com/photos/4210612/pexels-photo-4210612.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  psychiatrie: [
    "https://images.pexels.com/photos/9742768/pexels-photo-9742768.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  endocrinologie: [
    "https://images.pexels.com/photos/9742738/pexels-photo-9742738.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
  corticoïde: [
    "https://images.pexels.com/photos/3683080/pexels-photo-3683080.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop",
  ],
};

const DEFAULT_AVATAR =
  "https://images.pexels.com/photos/4210607/pexels-photo-4210607.jpeg?auto=compress&cs=tinysrgb&w=120&h=120&fit=crop";

export const resolveCategoryAvatar = (category, seed = 0) => {
  const key = category?.toLowerCase?.().trim?.() ?? "";
  const list = CATEGORY_AVATAR_MAP[key];
  if (!list || list.length === 0) return DEFAULT_AVATAR;
  const index = Math.abs(Number(seed) || 0) % list.length;
  return list[index];
};

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }
  return text;
};

const buildCsvContent = (rows, columns) => {
  const header = columns.map((column) => escapeCsvValue(column.header)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((column) => escapeCsvValue(row?.[column.accessor]))
      .join(",")
  );
  return [header, ...lines].join("\n");
};

const escapeHtmlValue = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const buildHtmlTable = (rows, columns) => {
  const headerRow = columns
    .map((column) => `<th>${escapeHtmlValue(column.header)}</th>`)
    .join("");
  const bodyRows = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${escapeHtmlValue(row?.[column.accessor])}</td>`)
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  return `<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;
};

const downloadBlob = (blob, filename) => {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

export const productsData = [
  { id: 1, product: "Doliprane 1000 mg", category: "Antalgique", status: "Actif", activity: "time-charge", date: "2024-09-01", stock: "En stock", quantity: 120, price: 4.5 },
  { id: 2, product: "Amoxicilline 500 mg", category: "Antibiotique", status: "Inactif", activity: "consultation", date: "2024-09-02", stock: "Faible", quantity: 32, price: 8.2 },
  { id: 3, product: "Ibuprofène 400 mg", category: "Anti-inflammatoire", status: "Inactif", activity: "time-charge", date: "2024-09-03", stock: "Épuisé", quantity: 0, price: 5.8 },
  { id: 4, product: "Paracétamol 500 mg", category: "Antalgique", status: "Actif", activity: "consultation", date: "2024-09-04", stock: "En stock", quantity: 240, price: 3.2 },
  { id: 5, product: "Azithromycine 250 mg", category: "Antibiotique", status: "Actif", activity: "time-charge", date: "2024-09-05", stock: "Faible", quantity: 18, price: 12.5 },
  { id: 6, product: "Cétirizine 10 mg", category: "Antihistaminique", status: "Actif", activity: "consultation", date: "2024-09-06", stock: "En stock", quantity: 75, price: 6.4 },
  { id: 7, product: "Oméprazole 20 mg", category: "Gastro-entérologie", status: "Actif", activity: "time-charge", date: "2024-09-07", stock: "Faible", quantity: 22, price: 9.1 },
  { id: 8, product: "Ventoline 100 µg", category: "Respiratoire", status: "Actif", activity: "consultation", date: "2024-09-08", stock: "En stock", quantity: 90, price: 14.0 },
  { id: 9, product: "Metformine 500 mg", category: "Diabète", status: "Actif", activity: "time-charge", date: "2024-09-09", stock: "Épuisé", quantity: 0, price: 7.3 },
  { id: 10, product: "Lisinopril 10 mg", category: "Cardiologie", status: "Actif", activity: "consultation", date: "2024-09-10", stock: "En stock", quantity: 140, price: 11.9 },
  { id: 11, product: "Atorvastatine 20 mg", category: "Cardiologie", status: "Actif", activity: "time-charge", date: "2024-09-11", stock: "Faible", quantity: 15, price: 16.4 },
  { id: 12, product: "Sertraline 50 mg", category: "Psychiatrie", status: "Actif", activity: "consultation", date: "2024-09-12", stock: "En stock", quantity: 60, price: 10.7 },
  { id: 13, product: "Levothyrox 50 µg", category: "Endocrinologie", status: "Actif", activity: "time-charge", date: "2024-09-13", stock: "En stock", quantity: 110, price: 8.9 },
  { id: 14, product: "Prednisone 20 mg", category: "Corticoïde", status: "Actif", activity: "consultation", date: "2024-09-14", stock: "Faible", quantity: 28, price: 6.1 },
  { id: 15, product: "Ranitidine 150 mg", category: "Gastro-entérologie", status: "Actif", activity: "time-charge", date: "2024-09-15", stock: "Épuisé", quantity: 0, price: 5.0 },
];

export const productsColumns = [
  {
    header: "Image",
    accessor: "avatar",
    render: (row) => {
      const avatarSrc = resolveCategoryAvatar(row.category, row.id);
      return (
        <img
          src={avatarSrc}
          alt={row.product}
          className="w-8 h-8 rounded-full"
          loading="lazy"
        />
      );
    },
  },
  { header: "Produit", accessor: "product" },
  { header: "Catégorie", accessor: "category" },
  { header: "Qte", accessor: "quantity" },
  {
    header: "Status",
    accessor: "status",
    render: (row) => <Badge status={row.status} />,
  },
  { header: "Stock", accessor: "stock", render: (row) => <Badge status={row.stock} /> },
];

const ProductsList = ({
  tableMaxHeightClass = "max-h-[46vh]",
  storeId = null,
} = {}) => {
  const { products: apiProducts, loading, refresh } = useProductsData({
    storeId,
  });
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [search, setSearch] = useSyncedQuerySearch("q");
  const [filterValues, setFilterValues] = useState({
    from: "",
    to: "",
    stock: "all",
    status: "all",
    keyword: "",
  });
  const [sortValues, setSortValues] = useState({
    date: "asc",
    activity: "az",
    name: "az",
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [pendingDeleteRows, setPendingDeleteRows] = useState([]);
  const showToast = useToastStore((state) => state.showToast);

  useEffect(() => {
    setProducts(apiProducts);
  }, [apiProducts]);

  const filteredProducts = useMemo(() => {
    const searchQuery = search.trim().toLowerCase();
    const keywordQuery = (filterValues.keyword ?? "").trim().toLowerCase();
    const hasSearch = Boolean(searchQuery);
    const hasKeyword = Boolean(keywordQuery);
    const statusFilter =
      filterValues.status && filterValues.status !== "all"
        ? filterValues.status.toLowerCase()
        : "";
    const stockFilter =
      filterValues.stock && filterValues.stock !== "all"
        ? filterValues.stock.toLowerCase()
        : "";
    const fromDate = filterValues.from ? new Date(filterValues.from) : null;
    const toDate = filterValues.to ? new Date(filterValues.to) : null;

    return products.filter((product) => {
      const productName = product.product?.toLowerCase() ?? "";
      const category = product.category?.toLowerCase() ?? "";
      const status = product.status?.toLowerCase() ?? "";

      if (statusFilter && status !== statusFilter) return false;
      if (stockFilter) {
        const stock = product.stock?.toLowerCase() ?? "";
        if (stock !== stockFilter) return false;
      }

      if (fromDate || toDate) {
        const rawDate = product.date || product.createdAt || product.updatedAt;
        if (rawDate) {
          const value = new Date(rawDate);
          if (fromDate && value < fromDate) return false;
          if (toDate && value > toDate) return false;
        }
      }

      const haystack = `${productName} ${category} ${status}`;
      if (hasSearch && !haystack.includes(searchQuery)) return false;
      if (hasKeyword && !haystack.includes(keywordQuery)) return false;

      return true;
    });
  }, [products, search, filterValues]);

  const sortedProducts = useMemo(() => {
    const next = [...filteredProducts];
    const compareText = (aValue, bValue, direction) => {
      const aText = (aValue ?? "").toString().toLowerCase();
      const bText = (bValue ?? "").toString().toLowerCase();
      if (direction === "desc" || direction === "za") {
        return bText.localeCompare(aText);
      }
      return aText.localeCompare(bText);
    };
    const compareDate = (aValue, bValue, direction) => {
      const aDate = aValue ? new Date(aValue).getTime() : 0;
      const bDate = bValue ? new Date(bValue).getTime() : 0;
      if (direction === "desc") return bDate - aDate;
      return aDate - bDate;
    };

    next.sort((a, b) => {
      const dateValueA = a.date || a.createdAt || a.updatedAt;
      const dateValueB = b.date || b.createdAt || b.updatedAt;
      const dateCompare = compareDate(dateValueA, dateValueB, sortValues.date);
      if (dateCompare !== 0) return dateCompare;

      const activityCompare = compareText(
        a.activity ?? "",
        b.activity ?? "",
        sortValues.activity
      );
      if (activityCompare !== 0) return activityCompare;

      return compareText(a.product ?? "", b.product ?? "", sortValues.name);
    });

    return next;
  }, [filteredProducts, sortValues]);

  const totalPages = Math.max(1, Math.ceil(sortedProducts.length / pageSize));
  const { pagedProducts, rangeLabel } = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, sortedProducts.length);
    const slice = sortedProducts.slice(startIndex, endIndex);
    const label =
      sortedProducts.length === 0
        ? "0 sur 0"
        : `${startIndex + 1}-${endIndex} sur ${sortedProducts.length}`;
    return { pagedProducts: slice, rangeLabel: label };
  }, [sortedProducts, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, search, filterValues]);

  const actionItems = [
    {
      id: 1,
      label: "Voir",
      icon: Eye,
      iconSize: 18,
      iconClassName: "p-1 text-primary rounded-lg",
      onClick: () => console.log("Voir"),
    },
    {
      id: 2,
      label: "Modifier",
      icon: SquarePen,
      iconSize: 18,
      iconClassName: "p-1 text-primary rounded-lg",
      onClick: () => console.log("Modifier"),
    },
    {
      id: 3,
      label: "Supprimer",
      icon: Trash,
      iconSize: 18,
      iconClassName: "p-1 bg-red-300 text-red-600 rounded-lg",
      variant: "danger",
      onClick: () => console.log("Supprimer"),
    },
  ];

  const deleteLabel =
    pendingDeleteRows.length === 1
      ? `le produit "${pendingDeleteRows[0]?.product ?? ""}"`
      : `les ${pendingDeleteRows.length} produits sélectionnés`;

  const exportColumns = useMemo(
    () =>
      productsColumns.filter(
        (column) =>
          column.accessor &&
          column.header &&
          column.header.toLowerCase() !== "avatar"
      ),
    []
  );

  const handleExport = (item) => {
    const exportRows = sortedProducts;
    const timestamp = new Date().toISOString().slice(0, 10);

    if (item?.id === "csv") {
      const csv = "\uFEFF" + buildCsvContent(exportRows, exportColumns);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, `neopharma-export-${timestamp}.csv`);
      return;
    }

    if (item?.id === "excel") {
      const tableHtml = buildHtmlTable(exportRows, exportColumns);
      const blob = new Blob(["\uFEFF" + tableHtml], {
        type: "application/vnd.ms-excel;charset=utf-8;",
      });
      downloadBlob(blob, `neopharma-export-${timestamp}.xls`);
      return;
    }

    if (item?.id === "pdf") {
      const tableHtml = buildHtmlTable(exportRows, exportColumns);
      const printWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!printWindow) return;
      printWindow.document.write(`
        <html>
          <head>
            <title>Export NeoPharma</title>
            <style>
              body { font-family: "Poppins", Arial, sans-serif; padding: 24px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 12px; }
              th { background: #f3f4f6; text-align: left; }
            </style>
          </head>
          <body>
            <h2>Export NeoPharma</h2>
            ${tableHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  };

  return (
    <>
      <DataTable
        title="Liste des produits"
        description="Tous les produits dans le système"
        columns={productsColumns}
        data={pagedProducts}
        emptyMessage={loading ? "Chargement..." : "Aucune donnee"}
        tableMaxHeightClass={tableMaxHeightClass}
        searchInput={{
          name: "search",
          value: search,
          onChange: setSearch,
          placeholder: "Rechercher...",
          type: "text",
        }}
        onFilterSelect={setFilterValues}
        onSortSelect={setSortValues}
        onExportSelect={handleExport}
        actionsHeader="Action"
        renderActions={() => (
          <DropdownAction
            label={<EllipsisVertical size={18} strokeWidth={1.5} />}
            items={actionItems}
            buttonClassName="rounded-lg bg-transparent p-1 text-text-primary hover:bg-header"
          />
        )}
        onDeleteSelected={(selectedRows) => {
          setPendingDeleteRows(selectedRows);
          setIsDeleteModalOpen(true);
        }}
        pagination={{
          page,
          totalPages,
          label: rangeLabel,
          onPageChange: (value) => setPage(value),
          onPrev: () => setPage((prev) => Math.max(1, prev - 1)),
          onNext: () => setPage((prev) => Math.min(totalPages, prev + 1)),
          disablePrev: page <= 1,
          disableNext: page >= totalPages,
        }}
        pageSizeSelect={{
          value: pageSize,
          options: [5, 10, 20, 50],
          onChange: (value) => setPageSize(value),
          label: "Afficher",
        }}
      />

      <Modal
        isOpen={isDeleteModalOpen}
        title="Confirmation de suppression"
        description={
          <p className="text-sm text-text-secondary">
            Voulez-vous vraiment supprimer{" "}
            <span className="font-semibold text-secondary">{deleteLabel}</span> ?
            Sachez que cette action est irréversible.
          </p>
        }
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        onCancel={() => {
          setIsDeleteModalOpen(false);
          setPendingDeleteRows([]);
        }}
        onConfirm={async () => {
          const selectedIds = pendingDeleteRows.map((row) => row.id);
          const deletedCount = pendingDeleteRows.length;
          const deletedName =
            deletedCount === 1 ? pendingDeleteRows[0]?.product ?? "" : "";
          try {
            await Promise.all(
              selectedIds.map((id) => apiDelete(`/api/products/${id}`))
            );
            showToast({
              title: "Suppression",
              message:
                deletedCount === 1
                  ? `Le produit "${deletedName}" a ete supprime.`
                  : `${deletedCount} produits ont ete supprimes.`,
              variant: "danger",
              duration: 3200,
            });
            refresh();
          } catch (error) {
            showToast({
              title: "Erreur",
              message: error.message || "Impossible de supprimer.",
              variant: "danger",
            });
          } finally {
            setIsDeleteModalOpen(false);
            setPendingDeleteRows([]);
          }
        }}
      />
    </>
  );
};

export default ProductsList;

