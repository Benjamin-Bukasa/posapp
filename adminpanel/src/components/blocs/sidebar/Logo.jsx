import React, { useEffect, useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen, Pill, X } from "lucide-react";
import useUiStore from "../../../stores/uiStore";
import useAuthStore from "../../../stores/authStore";

const Logo = () => {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
<<<<<<< HEAD
  const tenantName = useAuthStore((state) => state.user?.tenantName || "POSapp");
=======
  const tenantName = useAuthStore((state) => state.user?.tenantName || "NEOPHARMA");
>>>>>>> aed4c876093dd2e186d658b809f50bca4071b79d
  const buttonRef = useRef(null);
  const tooltipRef = useRef(null);
  const [tooltipSide, setTooltipSide] = useState("right");

  useEffect(() => {
    if (isSidebarOpen) return;

    const updatePosition = () => {
      const buttonEl = buttonRef.current;
      const tooltipEl = tooltipRef.current;
      if (!buttonEl) return;

      const rect = buttonEl.getBoundingClientRect();
      const tooltipWidth = tooltipEl?.offsetWidth ?? 0;
      const spaceLeft = rect.left;
      const spaceRight = window.innerWidth - rect.right;
      const margin = 8;
      const canShowRight = spaceRight >= tooltipWidth + margin;
      const canShowLeft = spaceLeft >= tooltipWidth + margin;

      if (canShowRight && !canShowLeft) {
        setTooltipSide("right");
        return;
      }

      if (canShowLeft && !canShowRight) {
        setTooltipSide("left");
        return;
      }

      setTooltipSide(spaceRight >= spaceLeft ? "right" : "left");
    };

    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isSidebarOpen]);

  return (
    <div className="flex w-full items-center justify-between gap-2">
      <div className="flex items-center justify-start gap-2">
        <Pill size={24} strokeWidth={2} className="text-accent" />
        <p
          className={[
            "max-w-[180px] truncate text-2xl font-semibold text-white",
            isSidebarOpen ? "block" : "block lg:hidden",
          ].join(" ")}
          title={tenantName}
        >
          {tenantName}
        </p>
      </div>
      <button
        type="button"
        onClick={closeMobileSidebar}
        className="rounded-lg p-1 text-accent lg:hidden"
        aria-label="Fermer le menu"
      >
        <X size={22} strokeWidth={1.8} />
      </button>
      <div className="group relative hidden lg:block">
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleSidebar}
          className="cursor-pointer text-accent"
          aria-label={isSidebarOpen ? "Reduire le sidebar" : "Voir plus"}
        >
          {isSidebarOpen ? (
            <PanelRightClose size={24} strokeWidth={1.25} />
          ) : (
            <PanelRightOpen size={24} strokeWidth={1.25} />
          )}
        </button>
        {!isSidebarOpen ? (
          <span
            ref={tooltipRef}
            className={[
              "pointer-events-none absolute top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-accent px-2 py-1 text-xs text-primary opacity-0 transition-opacity group-hover:opacity-100",
              tooltipSide === "right" ? "left-full ml-2" : "right-full mr-2",
            ].join(" ")}
          >
            Ouvrir
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default Logo;
