/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DropdownAction = ({
  label = "Action",
  items = [],
  onSelect,
  buttonClassName = "",
  menuClassName = "",
  itemClassName = "",
  menuBodyClassName = "",
  children,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 140,
    visibility: "hidden",
  });
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const closeMenu = () => setIsOpen(false);
  const toggleMenu = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const buttonEl = buttonRef.current;
      const menuEl = menuRef.current;

      if (!buttonEl || !menuEl) return;

      const buttonRect = buttonEl.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();
      const margin = 8;
      const viewportBelow = window.innerHeight - buttonRect.bottom;
      const viewportAbove = buttonRect.top;
      const viewportRight = window.innerWidth - buttonRect.right;
      const viewportLeft = buttonRect.left;

      const shouldOpenUp =
        viewportBelow < menuRect.height + margin &&
        viewportAbove >= menuRect.height + margin;

      let left = buttonRect.left;
      if (
        viewportRight < menuRect.width + margin &&
        viewportLeft >= menuRect.width + margin
      ) {
        left = buttonRect.right - menuRect.width;
      }

      left = Math.max(
        margin,
        Math.min(left, window.innerWidth - menuRect.width - margin),
      );

      const top = shouldOpenUp
        ? Math.max(margin, buttonRect.top - menuRect.height - margin)
        : Math.min(
            buttonRect.bottom + margin,
            window.innerHeight - menuRect.height - margin,
          );

      setMenuStyle({
        position: "fixed",
        top,
        left,
        zIndex: 140,
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
  }, [isOpen, items.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      const target = event.target;
      if (
        !containerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        closeMenu();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const renderItems = () => {
    if (typeof children === "function") return children({ closeMenu });
    if (children) return children;

    return items.map((item) => {
      const isDanger = item.variant === "danger";
      const isDisabled = Boolean(item.disabled);
      const baseClasses =
        "w-full rounded-lg border px-2 py-1 text-left text-sm transition-colors";
      const variantClasses = isDanger
        ? "border-red-600 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-300"
        : "border-transparent bg-transparent text-text-primary hover:bg-neutral-200/80 dark:hover:bg-white/10";
      const disabledClasses = isDisabled
        ? "cursor-not-allowed opacity-50 hover:bg-transparent"
        : "";

      return (
        <button
          key={item.id ?? item.label}
          type="button"
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return;
            if (item.onClick) item.onClick(item);
            if (onSelect) onSelect(item);
            closeMenu();
          }}
          className={[
            baseClasses,
            variantClasses,
            disabledClasses,
            itemClassName,
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            {item.icon ? (
              <span
                className={[
                  "inline-flex items-center justify-center",
                  item.iconClassName ?? "",
                ].join(" ")}
              >
                <item.icon size={item.iconSize ?? 18} strokeWidth={1.5} />
              </span>
            ) : null}
            <span>{item.label}</span>
          </div>
        </button>
      );
    });
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={toggleMenu}
        className={[
          "rounded-lg bg-[#b0bbb7] px-3 py-2 text-sm font-normal text-text-primary transition disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#1D473F] dark:text-white",
          buttonClassName,
        ].join(" ")}
      >
        {label}
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className={[
                "min-w-[180px] rounded-lg border border-border bg-surface text-text-primary shadow-lg",
                menuClassName,
              ].join(" ")}
            >
              <div
                className={[
                  menuBodyClassName || (children ? "p-2" : "flex flex-col gap-1 p-2"),
                ].join(" ")}
              >
                {renderItems()}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
};

export default DropdownAction;
