#!/usr/bin/env python3

import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional


def round_tenth(value: float) -> float:
    return round(value * 10) / 10


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def parse_payload_json(payload_json: str) -> dict:
    try:
        return json.loads(payload_json)
    except Exception:
        return {}


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def estimate_actual_minutes(act_started_at: Optional[str], completed_at: str, fallback_minutes: int) -> int:
    started = parse_datetime(act_started_at)
    completed = parse_datetime(completed_at)
    if started is None or completed is None:
        return fallback_minutes
    minutes = round((completed - started).total_seconds() / 60)
    return max(1, minutes or fallback_minutes)


def estimate_realized_roi(
    estimated_roi: float,
    estimated_minutes: int,
    actual_minutes: int,
    timeout_count: int,
    reoriented_count: int,
) -> float:
    schedule_factor = clamp(estimated_minutes / max(actual_minutes, 1), 0.55, 1.15)
    interruption_penalty = timeout_count * 0.12 + reoriented_count * 0.08
    return round_tenth(clamp(estimated_roi * schedule_factor * (1 - interruption_penalty), 0.4, 5))


def build_recent_labels(events: List[Dict]) -> List[str]:
    latest = datetime.now().astimezone()
    for event in events:
        event_at = parse_datetime(event.get("createdAt"))
        if event_at and event_at > latest:
            latest = event_at
    return [
        (latest - timedelta(days=(6 - index))).strftime("%m-%d")
        for index in range(7)
    ]


def count_events_for_label(events: List[Dict], label: str, event_type: str) -> int:
    return sum(
        1
        for event in events
        if event.get("eventType") == event_type and str(event.get("createdAt", ""))[5:10] == label
    )


def build_analysis(tasks: List[Dict], events: List[Dict], weights: Dict, ranked_tasks: List[Dict]) -> Dict:
    tasks_by_id = {task["id"]: task for task in tasks}
    completed_events = [event for event in events if event.get("eventType") == "completed"]
    timeout_events = [event for event in events if event.get("eventType") == "act_timed_out"]
    reoriented_events = [event for event in events if event.get("eventType") == "reoriented"]
    decomposed_events = [event for event in events if event.get("eventType") == "decomposed"]
    child_tasks = [task for task in tasks if task.get("parentTaskId") is not None]
    completed_children = [task for task in child_tasks if task.get("status") == "done"]
    total_expected_roi = round_tenth(sum(item.get("expectedRoi", 0) for item in ranked_tasks))

    outcomes = []
    for event in completed_events:
        task = tasks_by_id.get(event.get("taskId"))
        if not task:
            continue
        roi_score = task.get("roiScore")
        estimated_minutes = task.get("estimatedMinutes")
        if roi_score is None or estimated_minutes is None:
            continue

        task_events = [candidate for candidate in events if candidate.get("taskId") == task.get("id")]
        timeout_count = sum(1 for candidate in task_events if candidate.get("eventType") == "act_timed_out")
        reoriented_count = sum(1 for candidate in task_events if candidate.get("eventType") == "reoriented")
        payload = parse_payload_json(event.get("payloadJson", "{}"))
        actual_minutes = payload.get("actualMinutes")
        if not isinstance(actual_minutes, (int, float)):
            actual_minutes = estimate_actual_minutes(task.get("actStartedAt"), event.get("createdAt"), estimated_minutes)
        realized_roi = estimate_realized_roi(
            float(roi_score),
            int(estimated_minutes),
            int(actual_minutes),
            timeout_count,
            reoriented_count,
        )
        outcomes.append(
            {
                "label": str(event.get("createdAt", ""))[5:10],
                "estimatedMinutes": int(estimated_minutes),
                "actualMinutes": int(actual_minutes),
                "estimatedRoi": float(roi_score),
                "realizedRoi": realized_roi,
            }
        )

    action_count = len(completed_events) + len(timeout_events)
    completion_rate = 0 if action_count == 0 else len(completed_events) / action_count
    timeout_rate = 0 if action_count == 0 else len(timeout_events) / action_count
    reorientation_rate = 0 if len(completed_events) == 0 else len(reoriented_events) / len(completed_events)
    average_roi_gap = 0
    average_minutes_gap = 0
    if outcomes:
        average_roi_gap = round_tenth(
            sum(outcome["realizedRoi"] - outcome["estimatedRoi"] for outcome in outcomes) / len(outcomes)
        )
        average_minutes_gap = round_tenth(
            sum(outcome["actualMinutes"] - outcome["estimatedMinutes"] for outcome in outcomes) / len(outcomes)
        )
    focus_stability = round_tenth(clamp(1 - timeout_rate * 0.65 - reorientation_rate * 0.35, 0, 1) * 100) / 100

    labels = build_recent_labels(events)
    roi_series = []
    effort_series = []
    flow_series = []
    for label in labels:
        daily = [outcome for outcome in outcomes if outcome["label"] == label]
        if daily:
            roi_series.append(
                {
                    "label": label,
                    "estimated": round_tenth(sum(outcome["estimatedRoi"] for outcome in daily)),
                    "actual": round_tenth(sum(outcome["realizedRoi"] for outcome in daily)),
                }
            )
            effort_series.append(
                {
                    "label": label,
                    "estimated": round_tenth(sum(outcome["estimatedMinutes"] for outcome in daily)),
                    "actual": round_tenth(sum(outcome["actualMinutes"] for outcome in daily)),
                }
            )
        else:
            roi_series.append({"label": label, "estimated": 0, "actual": 0})
            effort_series.append({"label": label, "estimated": 0, "actual": 0})

        flow_series.append(
            {
                "label": label,
                "completed": count_events_for_label(events, label, "completed"),
                "timedOut": count_events_for_label(events, label, "act_timed_out"),
                "reoriented": count_events_for_label(events, label, "reoriented"),
            }
        )

    summary = {
        "completedCount": len(completed_events),
        "timeoutCount": len(timeout_events),
        "reorientedCount": len(reoriented_events),
        "decompositionCount": len(decomposed_events),
        "completionRate": completion_rate,
        "timeoutRate": timeout_rate,
        "reorientationRate": reorientation_rate,
        "decompositionCompletionRate": 0 if len(child_tasks) == 0 else len(completed_children) / len(child_tasks),
        "averageRoiGap": average_roi_gap,
        "averageMinutesGap": average_minutes_gap,
        "focusStability": focus_stability,
        "totalExpectedRoi": total_expected_roi,
    }

    suggestions = []
    effort_penalty = float(weights.get("effortPenalty", 0.8))
    roi_weight = float(weights.get("roi", 1.4))
    if summary["timeoutRate"] >= 0.35:
        suggestions.append(
            {
                "id": "raise-effort-penalty",
                "kind": "weight",
                "title": "時間見積もりが強気です",
                "summary": f"時間切れ率が {round(summary['timeoutRate'] * 100)}% あります。effortPenalty を {effort_penalty:.1f} から {effort_penalty + 0.2:.1f} へ上げる候補です。",
                "impactLabel": "開始前に短いタスクを上へ寄せる",
                "recommendedWeights": {
                    "effortPenalty": round_tenth(effort_penalty + 0.2),
                },
            }
        )

    if summary["averageRoiGap"] <= -0.6:
        suggestions.append(
            {
                "id": "temper-roi-weight",
                "kind": "weight",
                "title": "ROI 入力がやや楽観寄りです",
                "summary": f"見積もり ROI に対して実績差分が {summary['averageRoiGap']:.1f} です。roi 重みを {roi_weight:.1f} から {max(0.8, roi_weight - 0.2):.1f} へ落として、短期で回収しやすい候補を優先できます。",
                "impactLabel": "高見積もりの偏りを抑える",
                "recommendedWeights": {
                    "roi": round_tenth(max(0.8, roi_weight - 0.2)),
                },
            }
        )

    if summary["reorientationRate"] >= 0.25:
        suggestions.append(
            {
                "id": "tighten-observe-input",
                "kind": "input",
                "title": "Observe の材料が足りていません",
                "summary": f"再評価率が {round(summary['reorientationRate'] * 100)}% あります。Observe の時点で「何を見れば進めるか」を一言だけ残すと、Orient の戻りが減ります。",
                "impactLabel": "着手前の迷いを減らす",
            }
        )

    if summary["decompositionCount"] > 0 and summary["decompositionCompletionRate"] < 0.5:
        suggestions.append(
            {
                "id": "decompose-smaller",
                "kind": "decomposition",
                "title": "分割後の粒度をさらに小さくできます",
                "summary": f"分割完了率が {round(summary['decompositionCompletionRate'] * 100)}% です。分割タスクを 15〜25 分で終わる粒度に寄せると、完了まで届きやすくなります。",
                "impactLabel": "分割後の放置を減らす",
            }
        )

    if not suggestions:
        suggestions.append(
            {
                "id": "steady-loop",
                "kind": "confidence",
                "title": "判断ループは安定しています",
                "summary": "大きな補正候補はまだ出ていません。分析値が増えるほど、補正提案の精度も上がります。",
                "impactLabel": "このまま履歴を貯める",
            }
        )

    return {
        "analysisMetrics": {
            "summary": summary,
            "roiSeries": roi_series,
            "effortSeries": effort_series,
            "flowSeries": flow_series,
        },
        "analysisSuggestions": suggestions,
    }


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        result = build_analysis(
            payload.get("tasks", []),
            payload.get("events", []),
            payload.get("weights", {}),
            payload.get("rankedTasks", []),
        )
        json.dump(result, sys.stdout, ensure_ascii=False)
        return 0
    except Exception as error:
        sys.stderr.write(str(error))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
