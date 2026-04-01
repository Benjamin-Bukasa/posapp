import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const input = ({
  label,
  name,
  register,
  errors,
  type = "text",
  allowToggle = true,
  id,
  ...props
}) => {
  const hasError = Boolean(errors?.[name]);
  const registerProps =
    typeof register === "function" && name ? register(name) : {};
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);
  const resolvedType = isPassword && showPassword ? "text" : type;
  const inputId = id || name;

  return (
    <div className="flex flex-col gap-1">
      {label ? <label htmlFor={inputId}>{label}</label> : null}

      <div className="relative">
        <input
          {...registerProps}
          {...props}
          id={inputId}
          name={name}
          type={resolvedType}
          className={[
            "border p-2 rounded-lg bg-surface text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 w-full",
            isPassword && allowToggle ? "pr-10" : "",
            hasError
              ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500"
              : "border-border focus:ring-accent",
          ].join(" ")}
        />
        {isPassword && allowToggle ? (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff size={16} strokeWidth={1.6} />
            ) : (
              <Eye size={16} strokeWidth={1.6} />
            )}
          </button>
        ) : null}
      </div>

      {errors?.[name] && (
        <p className="text-red-500 text-sm">
          {errors[name].message}
        </p>
      )}
    </div>
  )
}

export default input;
