import React from 'react';

const button = ({ label, variant = "default", size = "default", className = "", ...props }) => {
  const baseClasses = "px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-offset-2";
  const variantClasses = {
    primary: "bg-primary text-white hover:bg-primary/90 focus:ring-primary/50",
    secondary: "bg-accent text-primary hover:bg-accent/90 focus:ring-accent/50",
    destructive: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500",
    default:
      "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-200 " +
      "dark:bg-surface dark:text-text-primary dark:border dark:border-border " +
      "dark:hover:bg-surface/70 dark:focus:ring-neutral-400",
  };
  const sizeClasses = {
    default: "text-sm",
    small: "text-xs",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
      {...props}
    >
      {label}
    </button>
  );
}

export default button;
