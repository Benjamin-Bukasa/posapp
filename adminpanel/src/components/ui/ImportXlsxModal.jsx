import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import SearchSelect from "./SearchSelect";

const acceptedFileTypes = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const formatBytes = (size = 0) => {
  if (!size) return "0 Ko";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
};

const isXlsxFile = (file) => {
  if (!file) return false;
  const lowerName = String(file.name || "").toLowerCase();
  return lowerName.endsWith(".xlsx");
};

const ImportXlsxModal = ({
  isOpen,
  title = "Importer un fichier XLSX",
  description,
  templateLabel = "Telecharger le template",
  importLabel = "Importer",
  cancelLabel = "Annuler",
  loading = false,
  templateLoading = false,
  result = null,
  selectionConfig = null,
  selectionValue = "",
  onSelectionChange,
  onClose,
  onDownloadTemplate,
  onImport,
}) => {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setDragActive(false);
      setSelectedFile(null);
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const fileError = useMemo(() => {
    if (!selectedFile) return "";
    if (!isXlsxFile(selectedFile)) {
      return "Seuls les fichiers .xlsx sont acceptes.";
    }
    return "";
  }, [selectedFile]);

  const resultErrors = Array.isArray(result?.errors) ? result.errors : [];
  const selectionError =
    selectionConfig?.required && !selectionValue
      ? `Veuillez selectionner ${selectionConfig.label?.toLowerCase() || "une option"}.`
      : "";

  if (!isOpen) return null;

  const handleFileSelection = (files) => {
    const nextFile = files?.[0] || null;
    setSelectedFile(nextFile);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (loading) return;
    handleFileSelection(event.dataTransfer?.files);
  };

  const handleImport = () => {
    if (!selectedFile || fileError || selectionError || loading) {
      return;
    }
    onImport?.(selectedFile, selectionValue);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Fermer la fenetre"
        onClick={loading ? undefined : onClose}
        disabled={loading}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-surface shadow-2xl ring-1 ring-black/5"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-text-primary">{title}</h3>
              <p className="mt-2 text-sm text-text-secondary">
                {description ||
                  "Deposez un fichier Excel .xlsx ou cliquez pour le selectionner."}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg p-2 text-text-secondary hover:bg-background hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Fermer"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-4">
            {selectionConfig ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-text-primary">
                  {selectionConfig.label}
                </label>
                <SearchSelect
                  name={selectionConfig.name || "import-selection"}
                  value={selectionValue}
                  onChange={onSelectionChange}
                  options={selectionConfig.options || []}
                  placeholder={selectionConfig.placeholder || "Rechercher..."}
                  emptyMessage={
                    selectionConfig.emptyMessage || "Aucune option trouvee."
                  }
                  required={selectionConfig.required}
                  disabled={loading || templateLoading}
                />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onDownloadTemplate}
                disabled={templateLoading || loading}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={16} strokeWidth={1.5} />
                {templateLoading ? "Telechargement..." : templateLabel}
              </button>
              <span className="text-xs text-text-secondary">
                Format accepte: fichier Excel `.xlsx`
              </span>
            </div>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!loading) setDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!loading) setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const target = event.currentTarget;
                if (!target.contains(event.relatedTarget)) {
                  setDragActive(false);
                }
              }}
              onDrop={handleDrop}
              disabled={loading}
              className={[
                "flex min-h-[220px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-10 text-center transition",
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background/50 hover:bg-background",
                loading ? "cursor-not-allowed opacity-70" : "cursor-pointer",
              ].join(" ")}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-header/20 text-primary">
                {selectedFile ? (
                  <FileSpreadsheet size={26} strokeWidth={1.5} />
                ) : (
                  <Upload size={26} strokeWidth={1.5} />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-base font-medium text-text-primary">
                  {selectedFile
                    ? "Fichier pret pour l'import"
                    : "Glissez-deposez votre fichier ici"}
                </p>
                <p className="text-sm text-text-secondary">
                  {selectedFile
                    ? `${selectedFile.name} - ${formatBytes(selectedFile.size)}`
                    : "ou cliquez pour parcourir vos fichiers"}
                </p>
              </div>

              {selectedFile ? (
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                  1 fichier selectionne
                </span>
              ) : null}
            </button>

            <input
              ref={inputRef}
              type="file"
              accept={acceptedFileTypes}
              className="hidden"
              onChange={(event) => handleFileSelection(event.target.files)}
            />

            {fileError ? (
              <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {fileError}
              </div>
            ) : null}

            {!fileError && selectionError ? (
              <div className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
                {selectionError}
              </div>
            ) : null}

            {result ? (
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                    Creees: {Number(result.created || 0)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      resultErrors.length
                        ? "bg-danger/10 text-danger"
                        : "bg-header/20 text-text-secondary"
                    }`}
                  >
                    Erreurs: {Number(result.failed || resultErrors.length || 0)}
                  </span>
                </div>

                {resultErrors.length ? (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-text-primary">
                      Apercu des erreurs
                    </h4>
                    <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-border">
                      <table className="min-w-full divide-y divide-border text-sm">
                        <thead className="bg-background">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-text-primary">
                              Ligne
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-text-primary">
                              Element
                            </th>
                            <th className="px-4 py-3 text-left font-medium text-text-primary">
                              Message
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {resultErrors.map((error, index) => (
                            <tr key={`${error.line || index}-${error.identifier || ""}`}>
                              <td className="px-4 py-3 align-top text-text-primary">
                                {error.line || "--"}
                              </td>
                              <td className="px-4 py-3 align-top text-text-secondary">
                                {error.identifier || "--"}
                              </td>
                              <td className="px-4 py-3 align-top text-danger">
                                {error.message || "Erreur non detaillee."}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-text-secondary">
                    Aucun detail d'erreur a afficher pour cet import.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border bg-surface/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={
              loading ||
              !selectedFile ||
              Boolean(fileError) ||
              Boolean(selectionError)
            }
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Import en cours..." : importLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportXlsxModal;
