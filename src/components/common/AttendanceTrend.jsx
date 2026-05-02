import React, { useMemo } from 'react';
import { useGuild } from '../../context/GuildContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

function renderAttendanceTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="card shadow-xl" style={{ border: "1px solid var(--border)", padding: "10px", background: "rgba(10, 15, 25, 0.95)", backdropFilter: "blur(8px)" }}>
        <p className="text-xs text-muted mb-1">{label}</p>
        <p className="font-cinzel text-sm" style={{ color: "var(--accent)" }}>
          Attendance: <span className="text-white">{payload[0].value}%</span>
        </p>
        <p className="text-xs text-muted">
          {payload[0].payload.present} / {payload[0].payload.total} Members
        </p>
      </div>
    );
  }
  return null;
}

const AttendanceTrend = () => {
  const { members, events, attendance } = useGuild();

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);

  const chartData = useMemo(() => {
    return events.slice(-10).map(ev => {
      const evAtt = attendance.filter(a => a.eventId === ev.eventId);
      const present = activeMembers.filter(m => {
        const a = evAtt.find(att => att.memberId === m.memberId);
        return (a?.status || "present") === "present";
      }).length;
      const pct = activeMembers.length ? Math.round((present / activeMembers.length) * 100) : 0;
      return {
        date: ev.eventDate,
        attendance: pct,
        present: present,
        total: evAtt.length,
        type: ev.eventType === "Guild League" ? "⚔️" : "🏰"
      };
    });
  }, [events, attendance, activeMembers]);

  return (
    <div className="card mb-4" style={{
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      border: "1px solid rgba(255,255,255,0.05)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(10, 15, 25, 0.6) 100%)",
      backdropFilter: "blur(12px)",
      boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
    }}>
      <div className="card-title" style={{ textShadow: "0 0 10px rgba(255,255,255,0.2)" }}>📈 Guild Attendance Trend</div>
      <div className="text-xs text-muted mt-1 mb-4">Tracking operation participation across the last 10 events.</div>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={250} minWidth={1} minHeight={1}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis
              dataKey="date"
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              domain={[0, 100]}
              dx={-10}
            />
            <Tooltip content={renderAttendanceTooltip} cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Area
              type="monotone"
              dataKey="attendance"
              stroke="var(--accent)"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorAtt)"
              animationDuration={1500}
              activeDot={{ r: 6, fill: "var(--accent)", stroke: "#fff", strokeWidth: 2, boxShadow: "0 0 10px var(--accent)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AttendanceTrend;
