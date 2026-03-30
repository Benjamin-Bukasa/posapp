import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";

const inputClassName =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition focus:border-secondary";

const SearchSelect = ({
  name,
  value,
  onChange,
  options = [],
  placeholder = "Rechercher...",
  disabled = false,
  emptyMessage = "Aucune option trouvee.",
  required = false,
}) => {
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuStyle, setMenuStyle] = useState({
    position: "fixed",
    top: 0,
    left: 0,
    width: 0,
    zIndex: 120,
    visibility: "hidden",
  });

  const selectedOption = useMemo(
    () =>
      options.find((option) => String(option.value) === String(value ?? "")) || null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      String(option.label || "")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedOption?.label || "");
    }
  }, [isOpen, selectedOption]);

  useEffect(() => {
    if (!inputRef.current) return;

    if (required && !value) {
      inputRef.current.setCustomValidity("Veuillez selectionner une option.");
      return;
    }

    inputRef.current.setCustomValidity("");
  }, [required, value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const updatePosition = () => {
      const inputEl = inputRef.current;
      const menuEl = menuRef.current;
      if (!inputEl || !menuEl) return;

      const inputRect = inputEl.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();
      const margin = 8;
      const viewportBelow = window.innerHeight - inputRect.bottom;
      const viewportAbove = inputRect.top;
      const shouldOpenUp =
        viewportBelow < menuRect.height + margin &&
        viewportAbove >= menuRect.height + margin;

      const top = shouldOpenUp
        ? Math.max(margin, inputRect.top - menuRect.height - margin)
        : Math.min(
            inputRect.bottom + margin,
            window.innerHeight - menuRect.height - margin,
          );

      setMenuStyle({
        position: "fixed",
        top,
        left: inputRect.left,
        width: inputRect.width,
        zIndex: 120,
        visibility: "visible",
      });
    };

    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [filteredOptions.length, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleSelect = (option) => {
    onChange?.(option.value);
    setQuery(option.label);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange?.("");
    setQuery("");
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          size={16}
          strokeWidth={1.5}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
        />
        <input
          ref={inputRef}
          name={`${name}-search`}
          type="text"
          value={query}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          autoComplete="off"
          className={`${inputClassName} pl-10 pr-20`}
          onFocus={() => {
            setQuery(selectedOption?.label || query);
            setIsOpen(true);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
        />
        <div className="absolute inset-y-0 right-3 flex items-center gap-1">
          {value ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="rounded-md p-1 text-text-secondary hover:bg-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Effacer"
            >
              <X size={14} strokeWidth={1.6} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (disabled) return;
              setIsOpen((current) => !current);
              if (!isOpen) {
                inputRef.current?.focus();
              }
            }}
            disabled={disabled}
            className="rounded-md p-1 text-text-secondary hover:bg-surface hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Ouvrir la liste"
          >
            <ChevronDown size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <input type="hidden" name={name} value={value ?? ""} readOnly />

      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className="max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-xl"
            >
              {filteredOptions.length ? (
                <div className="flex flex-col gap-1">
                  {filteredOptions.map((option) => {
                    const isSelected =
                      String(option.value) === String(value ?? "");

                    return (
                      <button
                        key={`${name}-${option.value}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelect(option)}
                        className={[
                          "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                          isSelected
                            ? "bg-primary text-white"
                            : "text-text-primary hover:bg-background",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-3 py-2 text-sm text-text-secondary">
                  {emptyMessage}
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default SearchSelect;
