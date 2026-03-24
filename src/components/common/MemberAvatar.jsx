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

export function MemberAvatar({ ign, index, size=34 }) {
  const c = AVATAR_COLORS[(index || 0) % AVATAR_COLORS.length];
  const initials = ign ? ign.slice(0,2).toUpperCase() : "??";
  return (
    <div style={{width:size,height:size,borderRadius:8,background:c.bg,color:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Cinzel,serif",fontSize:size*0.38,fontWeight:700,flexShrink:0}}>
      {initials}
    </div>
  );
}
