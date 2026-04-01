import React, { useCallback, useEffect, useRef, useState } from "react";
import { Upload, X } from "lucide-react";

const matchesAccept = (file, accept) => {
  if (!accept) return true;
  const rules = accept
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

const ImageDropzone = ({
  label = "Photo de profil",
  helper = "Glissez une image ici ou cliquez pour choisir.",
  accept = "image/*",
  maxSizeMb = 2,
  value,
  initials = "U",
  disabled = false,
  onFileSelect,
  onClear,
  onError,
  className = "",
}) => {
  const inputRef = useRef(null);
  const lastBlobRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [internalPreview, setInternalPreview] = useState("");
  const [error, setError] = useState("");
  const isControlled = value !== undefined;
  const previewUrl = isControlled ? value : internalPreview;

  const revokeBlob = useCallback((url) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const setPreview = useCallback(
    (next) => {
      if (!isControlled) {
        setInternalPreview((prev) => {
          if (prev && prev !== next) {
            revokeBlob(prev);
          }
          return next;
        });
      }
    },
    [isControlled, revokeBlob]
  );

  useEffect(() => {
    return () => {
      revokeBlob(lastBlobRef.current);
    };
  }, [revokeBlob]);

  const openPicker = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

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
    [accept, maxSizeMb]
  );

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        onError?.(validationError);
        return;
      }

      setError("");
      const nextPreview = URL.createObjectURL(file);
      revokeBlob(lastBlobRef.current);
      lastBlobRef.current = nextPreview;
      setPreview(nextPreview);
      onFileSelect?.(file, nextPreview);
    },
    [onError, onFileSelect, revokeBlob, setPreview, validateFile]
  );

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    handleFile(file);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    const file = event.dataTransfer?.files?.[0];
    handleFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleClear = (event) => {
    event?.stopPropagation();
    setError("");
    if (!isControlled) {
      setInternalPreview((prev) => {
        revokeBlob(prev);
        return "";
      });
    }
    revokeBlob(lastBlobRef.current);
    lastBlobRef.current = null;
    onClear?.();
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <div
        className={[
          "rounded-xl border border-dashed p-4 transition-colors",
          isDragging ? "border-secondary bg-secondary/10" : "border-border bg-surface",
          disabled ? "opacity-60" : "cursor-pointer",
        ].join(" ")}
        onClick={openPicker}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(event) => {
          if (disabled) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-background text-sm font-semibold text-text-primary">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Apercu profil"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-text-primary">{label}</p>
              <p className="text-xs text-text-secondary">{helper}</p>
              <p className="text-[11px] text-text-secondary">
                Formats: PNG, JPG. Max {maxSizeMb} MB.
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
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-text-primary hover:bg-surface"
            >
              <Upload size={14} strokeWidth={1.5} />
              Choisir
            </button>
            {previewUrl ? (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                <X size={14} strokeWidth={1.5} />
                Retirer
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {error ? <p className="text-xs text-red-500">{error}</p> : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />
    </div>
  );
};

export default ImageDropzone;
