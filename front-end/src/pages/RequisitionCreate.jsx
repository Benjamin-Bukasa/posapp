import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/button";
import Input from "../components/ui/input";
import Textarea from "../components/ui/textarea";
import useToastStore from "../stores/toastStore";
import useAuthStore from "../stores/authStore";
import { apiGet, apiPost, buildQuery } from "../services/apiClient";
import { useProductsData } from "../hooks/useProductsData";

const buildReference = (sequence) => `REQ${String(sequence).padStart(3, "0")}`;

const resolveNextSequence = (requests = []) => {
  let maxValue = 0;
  (requests || []).forEach((request) => {
    const source = `${request?.code || ""} ${request?.title || ""}`.trim();
    const match = source.match(/REQ\s*0*(\d+)/i);
    if (match?.[1]) {
      const parsed = Number(match[1]);
      if (!Number.isNaN(parsed)) {
        maxValue = Math.max(maxValue, parsed);
      }
    }
  });
  const fallback = (requests || []).length || 0;
  return Math.max(maxValue, fallback) + 1;
};

function RequisitionCreate() {
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const user = useAuthStore((state) => state.user);
  const storeId = user?.storeId || null;
  const { products, loading: loadingProducts } = useProductsData({ storeId });

  const [reference, setReference] = useState("REQ001");
  const [loadingReference, setLoadingReference] = useState(false);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState([]);
  const [query, setQuery] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [globalInventory, setGlobalInventory] = useState({});
  const [loadingGlobalInventory, setLoadingGlobalInventory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadReference = async () => {
      setLoadingReference(true);
      try {
        const queryString = buildQuery(storeId ? { storeId } : {});
        const suffix = queryString ? `?${queryString}` : "";
        const data = await apiGet(`/api/supply-requests${suffix}`);
        const list = Array.isArray(data?.data) ? data.data : data;
        const nextSequence = resolveNextSequence(list || []);
        if (!isMounted) return;
        setReference(buildReference(nextSequence));
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de generer la reference.",
          variant: "danger",
        });
      } finally {
        if (isMounted) setLoadingReference(false);
      }
    };
    loadReference();
    return () => {
      isMounted = false;
    };
  }, [showToast, storeId]);

  useEffect(() => {
    let isMounted = true;
    const loadGlobalInventory = async () => {
      setLoadingGlobalInventory(true);
      try {
        const data = await apiGet("/api/inventory");
        const list = Array.isArray(data?.data) ? data.data : data;
        const totals = (Array.isArray(list) ? list : []).reduce((acc, item) => {
          if (!item?.productId) return acc;
          const current = Number(acc[item.productId] || 0);
          acc[item.productId] = current + Number(item.quantity || 0);
          return acc;
        }, {});
        if (!isMounted) return;
        setGlobalInventory(totals);
      } catch (error) {
        showToast({
          title: "Erreur",
          message: error.message || "Impossible de charger le stock global.",
          variant: "danger",
        });
      } finally {
        if (isMounted) setLoadingGlobalInventory(false);
      }
    };
    loadGlobalInventory();
    return () => {
      isMounted = false;
    };
  }, [showToast]);

  const productMap = useMemo(() => {
    const map = new Map();
    (products || []).forEach((product) => {
      if (product?.id) map.set(product.id, product);
    });
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return products;
    return (products || []).filter((product) =>
      String(product?.product || "")
        .toLowerCase()
        .includes(keyword)
    );
  }, [products, query]);

  const handleAddProduct = (product) => {
    if (!product?.id) return;
    setLines((prev) => {
      if (prev.some((line) => line.productId === product.id)) {
        showToast({
          title: "Deja ajoute",
          message: "Ce produit est deja dans la liste.",
          variant: "warning",
        });
        return prev;
      }
      return [...prev, { productId: product.id, quantity: "" }];
    });
    setQuery("");
    setIsMenuOpen(false);
  };

  const handleQuantityChange = (index, value) => {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === index ? { ...line, quantity: value } : line
      )
    );
  };

  const handleRemoveLine = (index) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const items = lines
      .map((line) => ({
        productId: line.productId,
        quantity: Number(line.quantity || 0),
      }))
      .filter((item) => item.productId && item.quantity > 0);

    if (!items.length) {
      showToast({
        title: "Articles requis",
        message: "Ajoutez au moins un produit avec une quantite valide.",
        variant: "warning",
      });
      return;
    }

    setSubmitting(true);
    try {
      await apiPost("/api/supply-requests", {
        title: reference,
        note: note.trim() ? note.trim() : undefined,
        storeId: storeId || undefined,
        items,
      });
      showToast({
        title: "Requisition envoyee",
        message: "Votre demande a ete enregistree.",
        variant: "success",
      });
      navigate("/operations/requisitions");
    } catch (error) {
      showToast({
        title: "Erreur",
        message: error.message || "Impossible de creer la requisition.",
        variant: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Nouvelle requisition
          </h1>
          <p className="text-sm text-text-secondary">
            Creez une demande de stock pour plusieurs produits.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button
            type="button"
            label="Annuler"
            variant="default"
            size="small"
            className="w-full sm:w-auto"
            onClick={() => navigate(-1)}
          />
          <Button
            type="submit"
            label={submitting ? "Enregistrement..." : "Enregistrer"}
            variant="primary"
            size="small"
            disabled={submitting}
            form="requisition-form"
            className="w-full sm:w-auto"
          />
        </div>
      </div>

      <form
        id="requisition-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Input
            label="Numero de requisition"
            name="reference"
            value={reference}
            readOnly
            disabled={loadingReference}
          />
          <Input
            label="Boutique"
            name="store"
            value={user?.storeName || "Boutique"}
            readOnly
          />
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Produits
              </p>
              <p className="text-xs text-text-secondary">
                Recherchez un produit et ajoutez-le a la requisition.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Plus size={16} />
              Ajouter
            </div>
          </div>

          <div className="mt-4 relative">
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setIsMenuOpen(true);
              }}
              onFocus={() => setIsMenuOpen(true)}
              onBlur={() => setTimeout(() => setIsMenuOpen(false), 120)}
              placeholder="Rechercher un produit..."
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {isMenuOpen ? (
              <div className="absolute z-20 mt-2 w-full rounded-lg border border-border bg-surface shadow-lg">
                {loadingProducts ? (
                  <div className="p-3 text-sm text-text-secondary">
                    Chargement des produits...
                  </div>
                ) : filteredProducts.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleAddProduct(product)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-text-primary hover:bg-surface/70"
                      >
                        <div>
                          <p className="font-medium">{product.product}</p>
                          <p className="text-xs text-text-secondary">
                            Stock total:{" "}
                            {loadingGlobalInventory
                              ? "..."
                              : Number(globalInventory[product.id] || 0)}{" "}
                            | Boutique: {Number(product.quantity || 0)}
                          </p>
                        </div>
                        <span className="text-xs text-secondary">Ajouter</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-text-secondary">
                    Aucun produit correspondant.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-text-primary">Lignes</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-header dark:bg-secondary">
                <tr>
                  <th className="px-4 py-3 text-left">Produit</th>
                  <th className="px-4 py-3 text-left">Qte en stock</th>
                  <th className="px-4 py-3 text-left">Qte dans la boutique</th>
                  <th className="px-4 py-3 text-left">Qte demandee</th>
                  <th className="px-4 py-3 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-text-secondary"
                      colSpan={5}
                    >
                      Aucun produit ajoute.
                    </td>
                  </tr>
                ) : (
                  lines.map((line, index) => {
                    const product = productMap.get(line.productId);
                    const storeQty = Number(product?.quantity || 0);
                    const totalQty = Number(
                      globalInventory[line.productId] ?? storeQty
                    );
                    return (
                      <tr
                        key={`${line.productId}-${index}`}
                        className="border-b border-border"
                      >
                        <td className="px-4 py-2">
                          {product?.product || "Produit"}
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={totalQty}
                            readOnly
                            className="w-28 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text-secondary"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={storeQty}
                            readOnly
                            className="w-28 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text-secondary"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(event) =>
                              handleQuantityChange(index, event.target.value)
                            }
                            placeholder="0"
                            required
                            className="w-28 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(index)}
                            className="rounded-lg p-2 text-text-secondary hover:bg-surface/70 hover:text-text-primary"
                            aria-label="Supprimer la ligne"
                          >
                            <Trash2 size={16} strokeWidth={1.5} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <Textarea
            label="Note (optionnel)"
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Informations additionnelles..."
            rows={3}
          />
        </div>
      </form>
    </section>
  );
}

export default RequisitionCreate;
