export function computeScore({ event, att, perf }) {
  const status = att?.status || "present";
  const isPresent = status === "present";
  if (event.eventType === "Emperium Overrun") return 0;
  if (!isPresent) return 0;
  const ctf1 = perf?.ctf1 ?? perf?.ctfPoints ?? 0;
  const ctf2 = perf?.ctf2 ?? 0;
  const ctf3 = perf?.ctf3 ?? 0;
  const ctfTotal = ctf1 + ctf2 + ctf3;
  const pp = perf?.performancePoints ?? 0;
  const kills = perf?.kills ?? 0;
  const assists = perf?.assists ?? 0;
  return ctfTotal + pp + kills + assists;
}

export function computeAttendanceStatus(attendancePct) {
  if (attendancePct >= 80) return { label: "Reliable", color: "var(--green)", badge: "badge-active", icon: "✅" };
  if (attendancePct >= 60) return { label: "Average", color: "var(--gold)", badge: "badge-casual", icon: "⚠" };
  return { label: "At Risk", color: "var(--red)", badge: "badge-atrisk", icon: "🚨" };
}

export function computeLeaderboard(members, events, attendance, performance, eoRatings = []) {
  return members.map((member) => {
    let totalScore = 0;
    let presentCount = 0;
    let absentCount = 0;
    let consecutiveAbsent = 0;
    let tempConsecutive = 0;
    let totalKills = 0;
    let totalAssists = 0;
    let totalPP = 0;

    const mId = (member.memberId || "").toLowerCase();

    // Filter events: include if after Join Date OR if member has explicit data for it
    const eligibleEvents = events.filter(e => {
      if (!member.joinDate) return true;
      if (new Date(e.eventDate) >= new Date(member.joinDate)) return true;
      const hasAtt = attendance.some(a => (a.memberId || "").toLowerCase() === mId && a.eventId === e.eventId);
      const hasPerf = performance.some(p => (p.memberId || "").toLowerCase() === mId && p.eventId === e.eventId);
      return hasAtt || hasPerf;
    });

    const glEvents = eligibleEvents.filter(e => e.eventType === "Guild League");
    const eventCount = eligibleEvents.length;
    const glCount = glEvents.length;

    eligibleEvents.forEach((event) => {
      const att = attendance.find((a) => (a.memberId || "").toLowerCase() === mId && a.eventId === event.eventId);
      const perf = performance.find((p) => (p.memberId || "").toLowerCase() === mId && p.eventId === event.eventId);
      const status = att?.status || "present";
      if (status === "present") {
        presentCount++;
        tempConsecutive = 0;
      } else if (status === "loa") {
        absentCount++;
        tempConsecutive = 0; // Excused absence resets the streak
      } else {
        absentCount++;
        tempConsecutive++;
        if (tempConsecutive > consecutiveAbsent) consecutiveAbsent = tempConsecutive;
      }

      if (event.eventType === "Guild League") {
        totalScore += computeScore({ event, att, perf });
        totalKills += perf?.kills ?? 0;
        totalAssists += perf?.assists ?? 0;
        totalPP += perf?.performancePoints ?? 0;
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

    // EO-based calculations
    const memberEoRatings = eoRatings.filter(r => (r.memberId || "").toLowerCase() === mId);
    const totalEoScore = memberEoRatings.reduce((sum, r) => sum + (r.rating || 0), 0);
    const avgEoRating = memberEoRatings.length > 0 ? Math.round((totalEoScore / memberEoRatings.length) * 10) / 10 : 0;

    // Support Performance Index (SPI)
    // Formula: (Attendance * 0.5) + (Assists * 5) + (EO Rating * 10) + (Performance Points * 2)
    const supportIndex = Math.round((attendancePct * 0.5) + (totalPP * 2) + (totalAssists * 5) + (avgEoRating * 10));

    return { ...member, totalScore, attendancePct, avgScore, classification, absentCount, consecutiveAbsent, attStatus, avgEoRating, totalEoScore, supportIndex, totalKills, totalAssists, totalPP };
  }).sort((a, b) => b.totalScore - a.totalScore)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}
