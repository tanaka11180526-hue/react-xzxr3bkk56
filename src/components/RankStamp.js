import React from "react";
import { RANK_COLOR } from "../lib/score";

// レポートに押す評価のハンコ（ランクと点数。途中の日・週は「途中」と付ける）
export default function RankStamp({ score }) {
  return (
    <div className={"rp-rank" + (score.inProgress ? " now" : "")}>
      <span className="rp-rank-badge" style={{ "--c": RANK_COLOR[score.rank] }}>{score.rank}</span>
      {score.noPlan
        ? <span className="rp-rank-score">予定なし</span>
        : <span className="rp-rank-score">{score.score}点{score.inProgress && <em>途中</em>}</span>}
      {score.capped && <span className="rp-rank-cap">点数では{score.scoreRank}、勉強時間で上限{score.cap}</span>}
    </div>
  );
}
