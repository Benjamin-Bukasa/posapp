import React, { useEffect, useState } from "react";
import { Package } from "lucide-react";

const ProductThumbnail = ({
  src = "",
  alt = "Produit",
  className = "",
  iconSize = 20,
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const baseClassName = className || "h-12 w-12 rounded-lg";

  if (!src || hasError) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={[
          baseClassName,
          "flex shrink-0 items-center justify-center border border-border/70 bg-surface/70 text-text-secondary",
        ].join(" ")}
      >
        <Package size={iconSize} strokeWidth={1.8} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={[baseClassName, "shrink-0 object-cover"].join(" ")}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
};

export default ProductThumbnail;
