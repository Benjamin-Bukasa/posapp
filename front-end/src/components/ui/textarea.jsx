import React from 'react';

const textarea = ({ label, name, register, errors, ...props }) => {
  const hasError = Boolean(errors?.[name]);
  const registerProps =
    typeof register === "function" && name ? register(name) : {};

  return (
    <div className="flex flex-col gap-1">
      <label>{label}</label>
      <textarea
        {...registerProps}
        {...props}
        className={[
          "border p-2 rounded-lg bg-surface text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2",
          hasError
            ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500"
            : "border-border focus:ring-accent",
        ].join(" ")}
      />

      {errors?.[name] && (
        <p className="text-red-500 text-sm">
          {errors[name].message}
        </p>
      )}
    </div>
  );
}

export default textarea;
