import React, { useEffect, useMemo, useState } from "react";
import Modal from "./modal";
import Input from "./input";
import Textarea from "./textarea";

const buildEmptyItem = () => ({
  productId: "",
  quantity: "",
  note: "",
});

const SupplyRequestModal = ({
  isOpen,
  products = [],
  loading = false,
  onCancel,
  onSubmit,
}) => {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState([buildEmptyItem()]);

  useEffect(() => {
    if (!isOpen) return;
    setTitle("");
    setNote("");
    setItems([buildEmptyItem()]);
  }, [isOpen]);

  const productOptions = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        label: product.product || product.name || "Produit",
      })),
    [products]
  );

  const handleItemChange = (index, key, value) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, buildEmptyItem()]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleConfirm = () => {
    onSubmit?.({ title, note, items });
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Nouvelle requisition"
      description="Ajoutez les produits a demander pour votre boutique."
      confirmLabel={loading ? "Envoi..." : "Soumettre"}
      cancelLabel="Annuler"
      onCancel={onCancel}
      onConfirm={handleConfirm}
      confirmButtonClassName={loading ? "opacity-70 pointer-events-none" : ""}
    >
      <div className="grid gap-4">
        <Input
          label="Titre"
          name="requestTitle"
          placeholder="Ex: Requisition Hebdo"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Textarea
          label="Note (optionnel)"
          name="requestNote"
          rows={3}
          placeholder="Details ou justification"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />

        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">Articles</p>
          <button
            type="button"
            onClick={handleAddItem}
            className="rounded-lg border border-border bg-background px-3 py-1 text-xs font-medium text-text-primary hover:bg-surface"
          >
            Ajouter
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item, index) => (
            <div
              key={`item-${index}`}
              className="grid gap-2 md:grid-cols-[2fr_1fr_2fr_auto]"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-secondary">Produit</label>
                <select
                  value={item.productId}
                  onChange={(event) =>
                    handleItemChange(index, "productId", event.target.value)
                  }
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="">Selectionner...</option>
                  {productOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-secondary">Qté</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={item.quantity}
                  onChange={(event) =>
                    handleItemChange(index, "quantity", event.target.value)
                  }
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="0"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-text-secondary">Note</label>
                <input
                  type="text"
                  value={item.note}
                  onChange={(event) =>
                    handleItemChange(index, "note", event.target.value)
                  }
                  className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                  placeholder="Optionnel"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="rounded-lg px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                  disabled={items.length === 1}
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default SupplyRequestModal;
