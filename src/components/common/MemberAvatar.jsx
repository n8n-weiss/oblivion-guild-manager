/* eslint-disable react-refresh/only-export-components */
export const AVATAR_COLORS = [
  {bg:"rgba(99,130,230,0.18)",color:"var(--accent)"},
  {bg:"rgba(224,92,138,0.18)",color:"var(--accent2)"},
  {bg:"rgba(64,201,122,0.18)",color:"var(--green)"},
  {bg:"rgba(240,192,64,0.18)",color:"var(--gold)"},
  {bg:"rgba(167,139,250,0.18)",color:"#a78bfa"},
  {bg:"rgba(56,189,248,0.18)",color:"#38bdf8"},
  {bg:"rgba(251,146,60,0.18)",color:"#fb923c"},
  {bg:"rgba(244,114,182,0.18)",color:"#f472b6"},
  {bg:"rgba(52,211,153,0.18)",color:"#34d399"},
  {bg:"rgba(251,191,36,0.18)",color:"#fbbf24"},
];

import { JOB_CLASSES } from '../../utils/constants';

const CLASS_THEMES = (() => {
  const themes = {};
  const branchMaps = {
    "Swordsman Branch": "knight",
    "Acolyte Branch": "priest",
    "Mage Branch": "wizard",
    "Archer Branch": "archer",
    "Thief Branch": "assassin",
    "Merchant Branch": "blacksmith",
    "Doram Branch": "doram"
  };
  JOB_CLASSES.forEach(branch => {
    branch.jobs.forEach(job => {
      const branchKey = branchMaps[branch.branch];
      themes[job.name] = { 
        color: job.color, 
        icon: job.emoji, 
        portrait: branchKey ? `avatars/branch_${branchKey}.${branchKey === 'doram' ? 'jpg' : 'png'}` : null
      };
    });
  });
  // Fallbacks
  themes["Professor"] = { color: "var(--color-priest)", icon: "📖", portrait: "avatars/branch_wizard.png" };
  themes["Whitesmith"] = { color: "var(--color-blacksmith)", icon: "🔨", portrait: "avatars/branch_blacksmith.png" };
  themes["Creator"] = { color: "var(--color-blacksmith)", icon: "🧪", portrait: "avatars/branch_blacksmith.png" };
  themes["Minstrel"] = { color: "var(--color-priest)", icon: "🎵", portrait: "avatars/branch_archer.png" };
  themes["Diva"] = { color: "var(--color-priest)", icon: "🎤", portrait: "avatars/branch_archer.png" };
  return themes;
})();

const RANK_RING = {
  LEGEND:  { color: "#ff4d4d",  glow: "#ff4d4d66",  animate: true  },
  ELITE:   { color: "#ffcc00",  glow: "#ffcc0066",  animate: false },
  VETERAN: { color: "#33cc33",  glow: "#33cc3366",  animate: false },
  SOLDIER: { color: "#4db8ff",  glow: "#4db8ff66",  animate: false },
  NOVICE:  { color: "#666666",  glow: "#66666644",  animate: false },
};

function getRank(glScore) {
  if (glScore >= 200) return "LEGEND";
  if (glScore >= 150) return "ELITE";
  if (glScore >= 100) return "VETERAN";
  if (glScore >= 50)  return "SOLDIER";
  return "NOVICE";
}

/**
 * MemberAvatar
 * @param {string}  ign        - In-game name (used for initials)
 * @param {number}  index      - Member index (for fallback color)
 * @param {number}  size       - Avatar size in px (default 34)
 * @param {string}  memberClass - Member class string (e.g. "Lord Knight")
 * @param {number}  glScore    - Total GL score for rank ring
 * @param {boolean} hexagon    - Use hexagonal clip path (default false)
 */
export function MemberAvatar({ ign, index, size = 34, memberClass, glScore, hexagon = false }) {
  const c = AVATAR_COLORS[(index || 0) % AVATAR_COLORS.length];
  const initials = ign ? ign.slice(0, 2).toUpperCase() : "??";
  const classTheme = CLASS_THEMES[memberClass] || null;
  const rank = (glScore !== undefined && glScore !== null) ? getRank(glScore) : null;
  const ring = rank ? RANK_RING[rank] : null;

  // Hexagonal clip path
  const hexClip = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

  const ringColor = classTheme?.color || ring?.color || c.color;
  const showRing = !!(classTheme || ring);
  const ringSize = size + (hexagon ? 8 : 6);
  const iconSize = Math.max(10, Math.round(size * 0.32));

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {/* Rank / class ring */}
      {showRing && (
        <div
          style={{
            position: "absolute",
            top: -(ringSize - size) / 2,
            left: -(ringSize - size) / 2,
            width: ringSize,
            height: ringSize,
            borderRadius: hexagon ? 0 : "50%",
            clipPath: hexagon ? hexClip : undefined,
            background: `${ringColor}22`,
            border: `2px solid ${ringColor}`,
            boxShadow: `0 0 ${ring?.animate ? 14 : 8}px ${ring?.glow || ringColor + "44"}`,
            animation: ring?.animate ? "pulse-glow 2s infinite ease-in-out" : undefined,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Avatar body */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: hexagon ? 0 : size < 48 ? 8 : 12,
          clipPath: hexagon ? hexClip : undefined,
          background: classTheme?.portrait 
            ? `url(${classTheme.portrait}) center/cover no-repeat` 
            : (classTheme ? `${classTheme.color}22` : c.bg),
          backgroundColor: classTheme ? `${classTheme.color}44` : c.bg,
          color: classTheme?.color || c.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Cinzel,serif",
          fontSize: size * 0.38,
          fontWeight: 700,
          position: "relative",
          overflow: "hidden",
          border: classTheme?.portrait ? `1px solid ${ringColor}44` : "none",
        }}
      >
        {/* Shadow Overlay for portraits to make initials/text readable if needed, or just for style */}
        {classTheme?.portrait && (
          <div style={{
            position: "absolute", inset: 0,
            background: `linear-gradient(to top, rgba(10,14,24,0.6), transparent)`,
            pointerEvents: "none"
          }} />
        )}

        {/* Subtle glow top-right inside avatar */}
        {classTheme && (
          <div style={{
            position: "absolute", top: 0, right: 0, width: "60%", height: "60%",
            background: `radial-gradient(circle at top right, ${classTheme.color}44, transparent)`,
            pointerEvents: "none",
          }} />
        )}
        {!classTheme?.portrait && (memberClass === "Summoner" ? "🐱" : initials)}
      </div>

      {/* Class icon badge — bottom-right corner */}
      {classTheme && size >= 40 && (
        <div
          style={{
            position: "absolute",
            bottom: -2,
            right: -4,
            background: "var(--bg-deep, #0a0e18)",
            border: `1.5px solid ${classTheme.color}`,
            borderRadius: "50%",
            width: iconSize + 4,
            height: iconSize + 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: iconSize,
            lineHeight: 1,
            boxShadow: `0 0 6px ${classTheme.color}66`,
          }}
        >
          {classTheme.icon}
        </div>
      )}
    </div>
  );
}
