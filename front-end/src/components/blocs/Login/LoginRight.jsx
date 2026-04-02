import React, { useEffect, useMemo, useState } from "react";

const LoginRight = () => {
  const slides = useMemo(
    () => [
      {
        src: "https://i.pinimg.com/1200x/70/47/f4/7047f492e9a9614c7b548c54c8de9258.jpg",
        alt: "Accueil client",
      },
      {
        src: "https://i.pinimg.com/736x/27/06/d3/2706d3b6cb6b084b2d565d32d16e9dbb.jpg",
        alt: "Equipe en réunion",
      },
      {
        src: "https://i.pinimg.com/1200x/5d/92/58/5d92589d8659cf3f6c3d67727584df78.jpg",
        alt: "Professionnels en entreprise",
      },
    ],
    []
  );

  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) {
      return undefined;
    }
    const intervalId = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(intervalId);
  }, [slides.length]);

  return (
    <div className="relative hidden min-h-screen lg:block">
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            className={[
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              index === activeIndex ? "opacity-100" : "opacity-0",
            ].join(" ")}
            loading={index === 0 ? "eager" : "lazy"}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-tr from-surface/75 via-transparent to-transparent" />
      </div>

      <div className="absolute bottom-8 left-8 right-8 flex items-center justify-between">
        <div className="max-w-xs rounded-2xl bg-surface/80 p-4 text-sm text-text-secondary shadow-lg">
          Des équipes connectées, une Vendeur plus rapide.
        </div>
        <div className="flex items-center gap-2">
          {slides.map((_, index) => (
            <span
              key={`dot-${index}`}
              className={[
                "h-2 w-2 rounded-full transition-colors",
                index === activeIndex ? "bg-secondary" : "bg-surface/70",
              ].join(" ")}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginRight;
