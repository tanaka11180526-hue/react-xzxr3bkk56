import React from "react";
import { RANK_COLOR } from "../lib/score";

// レポートに押す評価のハンコ（ランクと点数。途中の日・週は「途中」と付ける）
export default function RankStamp({ score }) {
  return (
    <div className={"rp-rank" + (score.inProgress ? " now" : "")}>
      <span className="rp-rank-badge" style={{ "--c": RANK_COLOR[score.rank] }}>{score.rank}</span>
      <span className="rp-rank-score">{score.score}点{score.inProgress && <em>途中</em>}</span>
    </div>
  );
}
