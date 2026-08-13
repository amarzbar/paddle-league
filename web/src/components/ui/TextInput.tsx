import type { InputHTMLAttributes } from "react";

export function TextInput({
  label,
  ...props
}: { label?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label style={{ display: "block" }}>
      {label && (
        <span
          style={{
            display: "block",
            fontFamily: "Hanken Grotesk, sans-serif",
            fontWeight: 600,
            fontSize: 13,
            color: "#14304B",
            marginBottom: 6,
          }}
        >
          {label}
        </span>
      )}
      <input
        {...props}
        style={{
          width: "100%",
          height: 52,
          borderRadius: 14,
          border: "2px solid transparent",
          backgroundColor: "#F2F0EB",
          padding: "0 16px",
          fontFamily: "Hanken Grotesk, sans-serif",
          fontSize: 15,
          color: "#14304B",
          outline: "none",
          ...props.style,
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#14304B";
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "transparent";
          props.onBlur?.(e);
        }}
      />
    </label>
  );
}
