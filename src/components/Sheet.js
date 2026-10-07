import React from "react";

// 画面下から出るパネル
export default function Sheet({ title, subtitle, onClose, children, actions }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="grabber" />
        {(title || actions) && (
          <div className="sheet-head">
            <div>
              {subtitle && <div className="sheet-sub">{subtitle}</div>}
              {title && <h2>{title}</h2>}
            </div>
            <div className="sheet-actions">
              {actions}
              <button className="btn ghost small" onClick={onClose}>閉じる</button>
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
