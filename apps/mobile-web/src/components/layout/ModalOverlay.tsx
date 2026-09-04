import React from "react";

interface ModalOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const ModalOverlay: React.FC<ModalOverlayProps> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: "16px",
    }} onClick={onClose}>
      <div style={{
        background: "#16162a", border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: "20px", maxWidth: "440px", width: "100%",
        padding: "28px", boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        maxHeight: "90vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        {title && (
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#e8e8f0", margin: "0 0 20px 0" }}>{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
};
