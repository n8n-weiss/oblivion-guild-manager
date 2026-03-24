export function computeScore({ event, att, perf }) {
  const isPresent = att?.status === "present";
  if (event.eventType === "Emperium Overrun") return 0;
  if (!isPresent) return 0;
  const ctf1 = perf?.ctf1 ?? perf?.ctfPoints ?? 0;
  const ctf2 = perf?.ctf2 ?? 0;
  const ctf3 = perf?.ctf3 ?? 0;
  const ctfTotal = ctf1 + ctf2 + ctf3;
  const pp = perf?.performancePoints ?? 0;
  return ctfTotal + pp;
}

export function computeAttendanceStatus(attendancePct) {
  if (attendancePct >= 80) return { label: "Reliable", color: "var(--green)", badge: "badge-active", icon: "✅" };
  if (attendancePct >= 60) return { label: "Average", color: "var(--gold)", badge: "badge-casual", icon: "⚠" };
  return { label: "At Risk", color: "var(--red)", badge: "badge-atrisk", icon: "🚨" };
}

export function computeLeaderboard(members, events, attendance, performance) {
  return members.map((member) => {
    let totalScore = 0;
    let presentCount = 0;
    let absentCount = 0;
    let consecutiveAbsent = 0;
    let tempConsecutive = 0;
    const glEvents = events.filter(e => e.eventType === "Guild League");
    const eventCount = events.length;
    const glCount = glEvents.length;

    events.forEach((event) => {
      const att = attendance.find((a) => a.memberId === member.memberId && a.eventId === event.eventId);
      const perf = performance.find((p) => p.memberId === member.memberId && p.eventId === event.eventId);
      if (att?.status === "present") {
        presentCount++;
        tempConsecutive = 0;
      } else {
        absentCount++;
        tempConsecutive++;
        if (tempConsecutive > consecutiveAbsent) consecutiveAbsent = tempConsecutive;
      }
      if (event.eventType === "Guild League") {
        totalScore += computeScore({ event, att, perf });
      }
    });

    const attendancePct = eventCount > 0 ? Math.round((presentCount / eventCount) * 100) : 0;
    const avgScore = glCount > 0 ? Math.round((totalScore / glCount) * 10) / 10 : 0;
    const attStatus = computeAttendanceStatus(attendancePct);

    // Score-based classification (for dashboard charts)
    let classification = "At Risk";
    if (totalScore > 80) classification = "Core";
    else if (totalScore >= 60) classification = "Active";
    else if (totalScore >= 40) classification = "Casual";

    return { ...member, totalScore, attendancePct, avgScore, classification, absentCount, consecutiveAbsent, attStatus };
  }).sort((a, b) => b.totalScore - a.totalScore)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}
