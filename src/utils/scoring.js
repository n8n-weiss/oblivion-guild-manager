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

export function computeLeaderboard(members, events, attendance, performance, eoRatings = [], filterMonth = null, filterYear = null) {
  return members.map((member) => {
    let totalScore = 0;
    let presentCount = 0;
    let absentCount = 0;
    let consecutiveAbsent = 0;
    let tempConsecutive = 0;
    let totalKills = 0;
    let totalAssists = 0;
    let totalPP = 0;
    let totalCTF = 0;

    const mId = (member.memberId || "").toLowerCase();

    // Filter events: include if after Join Date OR if member has explicit data for it
    const eligibleEvents = events.filter(e => {
      if (filterMonth && String(e?.eventDate || "").slice(0, 7) !== filterMonth) return false;
      if (filterYear && String(e?.eventDate || "").slice(0, 4) !== filterYear) return false;
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
      } else {
        absentCount++;
        tempConsecutive++;
        if (tempConsecutive > consecutiveAbsent) consecutiveAbsent = tempConsecutive;
      }

      if (event.eventType === "Guild League") {
        totalKills += perf?.kills ?? 0;
        totalAssists += perf?.assists ?? 0;
        totalPP += perf?.performancePoints ?? 0;
        const ctf = (perf?.ctf1 ?? perf?.ctfPoints ?? 0) + (perf?.ctf2 ?? 0) + (perf?.ctf3 ?? 0);
        totalCTF += ctf;
        totalScore += computeScore({ event, att, perf });
      }
    });

    const attendancePct = eventCount > 0 ? Math.round((presentCount / eventCount) * 100) : 0;
    const avgScore = glCount > 0 ? Math.round((totalScore / glCount) * 10) / 10 : 0;
    const attStatus = computeAttendanceStatus(attendancePct);

    const mEoRatings = eoRatings.filter(r => (r.memberId || "").toLowerCase() === mId);
    const avgEoRating = mEoRatings.length > 0 
      ? Math.round((mEoRatings.reduce((s, r) => s + r.rating, 0) / mEoRatings.length) * 10) / 10 : 0;

    return { ...member, totalScore, attendancePct, avgScore, avgEoRating, absentCount, consecutiveAbsent, attStatus, totalKills, totalAssists, totalPP, totalCTF };
  }).sort((a, b) => b.totalScore - a.totalScore)
    .map((m, i) => ({ ...m, rank: i + 1 }));
}
