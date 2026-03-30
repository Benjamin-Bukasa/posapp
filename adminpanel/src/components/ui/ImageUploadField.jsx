import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";

const matchesAccept = (file, accept) => {
  if (!accept) return true;

  const rules = String(accept)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!rules.length) return true;

  return rules.some((rule) => {
    if (rule === "image/*") {
      return file.type.startsWith("image/");
    }
    if (rule.endsWith("/*")) {
      const prefix = rule.replace("/*", "/");
      return file.type.startsWith(prefix);
    }
    if (rule.startsWith(".")) {
      return file.name.toLowerCase().endsWith(rule.toLowerCase());
    }
    return file.type === rule;
  });
};

const ImageUploadField = ({
  value,
  onFileSelect,
  onClear,
  disabled = false,
  uploading = false,
  accept = "image/*",
  maxSizeMb = 5,
  helper = "Glissez une image ici ou cliquez pour choisir.",
}) => {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");

  const openPicker = useCallback(() => {
    if (disabled || uploading) return;
    inputRef.current?.click();
  }, [disabled, uploading]);

  const validateFile = useCallback(
    (file) => {
      if (!matchesAccept(file, accept)) {
        return "Type de fichier non supporte.";
      }
      if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
        return `Fichier trop volumineux (max ${maxSizeMb} MB).`;
      }
      return "";
    },
    [accept, maxSizeMb],
  );

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError("");
      await onFileSelect?.(file);
    },
    [onFileSelect, validateFile],
  );

  useEffect(() => {
    if (value) {
      setError("");
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={[
          "rounded-2xl border border-dashed p-4 transition-colors",
          isDragging ? "border-secondary bg-secondary/10" : "border-border bg-background",
          disabled || uploading ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        ].join(" ")}
        onClick={openPicker}
        onDragOver={(event) => {
          event.preventDefault();
          if (disabled || uploading) return;
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={async (event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled || uploading) return;
          await handleFile(event.dataTransfer?.files?.[0]);
        }}
        role="button"
        tabIndex={disabled || uploading ? -1 : 0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface">
              {value ? (
                <img src={value} alt="Apercu produit" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus size={24} className="text-text-secondary" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-text-primary">
                {uploading ? "Telechargement en cours..." : "Image produit/article"}
              </p>
              <p className="text-xs text-text-secondary">{helper}</p>
              <p className="text-[11px] text-text-secondary">
                Formats: JPG, PNG, WEBP, GIF. Max {maxSizeMb} MB.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openPicker();
              }}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ImagePlus size={16} />
              {value ? "Changer" : "Choisir"}
            </button>
            {value ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClear?.();
                }}
                disabled={disabled || uploading}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={16} />
                Retirer
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (event) => {
          await handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
        disabled={disabled || uploading}
      />
    </div>
  );
};

export default ImageUploadField;
