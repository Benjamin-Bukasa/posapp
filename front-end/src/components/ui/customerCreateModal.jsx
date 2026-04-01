import React, { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

const padNumber = (value, length) => String(value).padStart(length, "0");

const buildClientCode = ({ firstName, lastName, sequence, date }) => {
  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "XX";
  const month = padNumber(date.getMonth() + 1, 2);
  const year = date.getFullYear();
  const seq = padNumber(sequence, 4);
  return `${initials}${seq}${month}${year}`;
};

const CustomerCreateModal = ({
  isOpen,
  onClose,
  onSubmit,
  nextSequence = 1,
}) => {
  const [civility, setCivility] = useState("Mr");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [avenue, setAvenue] = useState("");
  const [commune, setCommune] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setCivility("Mr");
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setStreetNumber("");
    setAvenue("");
    setCommune("");
    setCity("");
    setError("");
    setSubmitting(false);
  }, [isOpen]);

  const previewCode = useMemo(
    () =>
      buildClientCode({
        firstName,
        lastName,
        sequence: nextSequence,
        date: new Date(),
      }),
    [firstName, lastName, nextSequence]
  );

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Le prénom et le nom sont requis.");
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setError("Le téléphone ou l'email est requis.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const now = new Date();
      const clientCode = buildClientCode({
        firstName,
        lastName,
        sequence: nextSequence,
        date: now,
      });
      const addressLine = [streetNumber.trim(), avenue.trim()]
        .filter(Boolean)
        .join(" ");

      await onSubmit?.({
        civility,
        code: clientCode,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        addressLine: addressLine || null,
        commune: commune.trim() || null,
        city: city.trim() || null,
      });
    } catch (submitError) {
      setError(submitError?.message || "Erreur lors de la création.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Fermer la fenêtre"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-xs text-text-secondary">Client</p>
            <h3 className="text-xl font-semibold text-text-primary">
              Créer un compte
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-surface/70 hover:text-text-primary"
            aria-label="Fermer"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase text-text-secondary">
              Civilité
            </p>
            <div className="mt-2 flex items-center gap-2">
              {["Mr", "Mme"].map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCivility(option)}
                  className={[
                    "rounded-lg border px-3 py-2 text-sm font-medium",
                    civility === option
                      ? "border-secondary bg-secondary/10 text-secondary"
                      : "border-border bg-surface text-text-primary hover:bg-surface/70",
                  ].join(" ")}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-text-secondary">Prénom</label>
              <input
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Nom</label>
              <input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Téléphone</label>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-text-secondary">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase text-text-secondary">
              Adresse
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-text-secondary">N°</label>
                <input
                  type="text"
                  value={streetNumber}
                  onChange={(event) => setStreetNumber(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Avenue</label>
                <input
                  type="text"
                  value={avenue}
                  onChange={(event) => setAvenue(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Commune</label>
                <input
                  type="text"
                  value={commune}
                  onChange={(event) => setCommune(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary">Ville</label>
                <input
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Code client</span>
              <span className="font-semibold text-text-primary">
                {previewCode}
              </span>
            </div>
          </div>

          {error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface/80 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-background px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface dark:bg-surface dark:border dark:border-border dark:hover:bg-surface/70"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={[
              "rounded-lg px-4 py-2 text-sm font-medium text-white",
              submitting
                ? "cursor-not-allowed bg-secondary/70"
                : "bg-secondary hover:bg-secondary/90",
            ].join(" ")}
          >
            {submitting ? "Création..." : "Créer le client"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerCreateModal;
