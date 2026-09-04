import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary", size = "md", fullWidth = false, isLoading = false,
  children, style, disabled, ...props
}) => {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px",
    borderRadius: "999px", fontWeight: 600, cursor: disabled || isLoading ? "not-allowed" : "pointer",
    fontFamily: "'Satoshi', sans-serif", transition: "all 0.15s ease-out", opacity: disabled || isLoading ? 0.6 : 1,
    width: fullWidth ? "100%" : "auto",
  };

  const variants = {
    primary: { backgroundColor: "#4f8fff", color: "#fff", border: "none" },
    secondary: { backgroundColor: "rgba(255,255,255,0.08)", color: "#e8e8f0", border: "none" },
    outline: { backgroundColor: "transparent", color: "#4f8fff", border: "1px solid rgba(79,143,255,0.3)" },
    ghost: { backgroundColor: "transparent", color: "#a0a0b8", border: "none" },
    danger: { backgroundColor: "#f87171", color: "#fff", border: "none" },
  };

  const sizes = {
    sm: { padding: "8px 16px", fontSize: "12px" },
    md: { padding: "12px 24px", fontSize: "14px" },
    lg: { padding: "16px 32px", fontSize: "16px" },
  };

  return (
    <button
      style={{ ...baseStyle, ...variants[variant], ...sizes[size], ...style }}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "Loading..." : children}
    </button>
  );
};
