export const DEFAULT_SUBJECTS = [
  { id: "financial",  label: "財務会計", short: "財務", color: "#60A5FA" },
  { id: "management", label: "管理会計", short: "管理", color: "#34D399" },
  { id: "audit",      label: "監査論",   short: "監査", color: "#FBBF24" },
  { id: "corporate",  label: "企業法",   short: "企業", color: "#C084FC" },
  { id: "tax",        label: "租税法",   short: "租税", color: "#F87171" },
  { id: "business",   label: "経営学",   short: "経営", color: "#38BDF8" },
];

export const COLOR_PALETTE = [
  "#93C5FD", "#60A5FA", "#3B82F6", "#2563EB", "#1D4ED8",
  "#C4B5FD", "#A78BFA", "#8B5CF6", "#7C3AED", "#E879F9",
  "#FDA4AF", "#F87171", "#EF4444", "#DC2626", "#FB7185",
  "#FCD34D", "#FBBF24", "#F59E0B", "#FB923C", "#F97316",
  "#86EFAC", "#4ADE80", "#34D399", "#10B981", "#059669",
  "#67E8F9", "#38BDF8", "#22D3EE", "#06B6D4", "#2DD4BF",
  "#FDE68A", "#FCA5A5", "#FDBA74", "#FDE047", "#BEF264",
  "#E5E7EB", "#D1D5DB", "#9CA3AF", "#E5E1D8", "#F0EDE6",
];

// 一時停止がこの時間を超えると休憩に切り替わる
export const PAUSE_LIMIT_MS = 30000;

// 休憩はこの時間で自動的に終わる（止め忘れ対策）
export const BREAK_LIMIT_MS = 3 * 3600 * 1000;

// スプレッドシートの科目名がどの科目にも当てはまらないときの色
export const UNKNOWN_COLOR = "#6B7280";
