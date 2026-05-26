import * as React from "react";
import { Button } from "./button";

interface DialogProps {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function Dialog({ open, title, children, onClose }: DialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation">
      <div
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="dialog"
        role="dialog"
      >
        <div className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
