export const INITIAL_MEMBERS = [
  { memberId: "OBL001", ign: "DarkReaper", class: "Assassin Cross", role: "DPS" },
  { memberId: "OBL002", ign: "HolyShield", class: "High Priest", role: "Support" },
  { memberId: "OBL003", ign: "StormBlade", class: "Lord Knight", role: "DPS" },
  { memberId: "OBL004", ign: "SilentArrow", class: "Sniper", role: "DPS" },
  { memberId: "OBL005", ign: "ArcaneVeil", class: "High Wizard", role: "DPS" },
  { memberId: "OBL006", ign: "IronFortress", class: "Paladin", role: "Support" },
  { memberId: "OBL007", ign: "NightCrawler", class: "Stalker", role: "DPS" },
  { memberId: "OBL008", ign: "MysticHeal", class: "Scholar (Professor)", role: "Support" },
  { memberId: "OBL009", ign: "BlazeKnight", class: "Paladin", role: "DPS" },
  { memberId: "OBL010", ign: "VoidWalker", class: "Stalker", role: "DPS" },
  { memberId: "OBL011", ign: "Catnip", class: "Summoner", role: "Support" },
];

export const INITIAL_EVENTS = [
  { eventId: "EVT001", eventType: "Guild League", eventDate: "2025-07-07" },
  { eventId: "EVT002", eventType: "Guild League", eventDate: "2025-07-08" },
  { eventId: "EVT003", eventType: "Emperium Overrun", eventDate: "2025-07-09" },
  { eventId: "EVT004", eventType: "Guild League", eventDate: "2025-07-10" },
];

export const INITIAL_ATTENDANCE = [
  { memberId: "OBL001", eventId: "EVT001", status: "present" },
  { memberId: "OBL002", eventId: "EVT001", status: "present" },
  { memberId: "OBL003", eventId: "EVT001", status: "absent" },
  { memberId: "OBL004", eventId: "EVT001", status: "present" },
  { memberId: "OBL005", eventId: "EVT001", status: "absent" },
  { memberId: "OBL006", eventId: "EVT001", status: "present" },
  { memberId: "OBL007", eventId: "EVT001", status: "present" },
  { memberId: "OBL008", eventId: "EVT001", status: "present" },
  { memberId: "OBL009", eventId: "EVT001", status: "absent" },
  { memberId: "OBL010", eventId: "EVT001", status: "present" },
  { memberId: "OBL001", eventId: "EVT002", status: "present" },
  { memberId: "OBL002", eventId: "EVT002", status: "absent" },
  { memberId: "OBL003", eventId: "EVT002", status: "present" },
  { memberId: "OBL004", eventId: "EVT002", status: "present" },
  { memberId: "OBL005", eventId: "EVT002", status: "present" },
  { memberId: "OBL006", eventId: "EVT002", status: "present" },
  { memberId: "OBL007", eventId: "EVT002", status: "absent" },
  { memberId: "OBL008", eventId: "EVT002", status: "present" },
  { memberId: "OBL009", eventId: "EVT002", status: "present" },
  { memberId: "OBL010", eventId: "EVT002", status: "present" },
];

export const INITIAL_PERFORMANCE = [
  { memberId: "OBL001", eventId: "EVT001", ctfPoints: 8, performancePoints: 12 },
  { memberId: "OBL002", eventId: "EVT001", ctfPoints: 3, performancePoints: 18 },
  { memberId: "OBL004", eventId: "EVT001", ctfPoints: 6, performancePoints: 10 },
  { memberId: "OBL006", eventId: "EVT001", ctfPoints: 2, performancePoints: 20 },
  { memberId: "OBL007", eventId: "EVT001", ctfPoints: 5, performancePoints: 9 },
  { memberId: "OBL008", eventId: "EVT001", ctfPoints: 1, performancePoints: 16 },
  { memberId: "OBL010", eventId: "EVT001", ctfPoints: 7, performancePoints: 11 },
  { memberId: "OBL001", eventId: "EVT002", ctfPoints: 10, performancePoints: 14 },
  { memberId: "OBL003", eventId: "EVT002", ctfPoints: 9, performancePoints: 13 },
  { memberId: "OBL004", eventId: "EVT002", ctfPoints: 7, performancePoints: 8 },
  { memberId: "OBL005", eventId: "EVT002", ctfPoints: 4, performancePoints: 11 },
  { memberId: "OBL006", eventId: "EVT002", ctfPoints: 2, performancePoints: 22 },
  { memberId: "OBL008", eventId: "EVT002", ctfPoints: 1, performancePoints: 19 },
  { memberId: "OBL009", eventId: "EVT002", ctfPoints: 6, performancePoints: 9 },
  { memberId: "OBL010", eventId: "EVT002", ctfPoints: 8, performancePoints: 12 },
];

export const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "members", label: "Members", icon: "members" },
  { id: "events", label: "Events", icon: "events" },
  { id: "absences", label: "Absences", icon: "absence" },
  { id: "leaderboard", label: "Leaderboard", icon: "leaderboard" },
  { id: "party", label: "Party Builder", icon: "party" },
  { id: "import", label: "Import CSV", icon: "save" },
  { id: "report", label: "Weekly Report", icon: "report" },
  { id: "auction", label: "Auction Builder", icon: "trophy" },
  { id: "users", label: "User Management", icon: "users" },
  { id: "auditlog", label: "Audit Log", icon: "report" },
];

export const PARTY_NAMES = ["Alpha Squad", "Bravo Force", "Charlie Wing", "Delta Strike", "Echo Vanguard", "Foxtrot Blade"];

export const JOB_CLASSES = [
  {
    branch: "Swordsman Branch",
    jobs: [
      { name: "Lord Knight", emoji: "⚔️", color: "var(--color-knight)" },
      { name: "Paladin", emoji: "🛡️", color: "var(--color-knight)" }
    ]
  },
  {
    branch: "Acolyte Branch",
    jobs: [
      { name: "High Priest", emoji: "✨", color: "var(--color-priest)" },
      { name: "Champion", emoji: "👊", color: "var(--color-knight)" }
    ]
  },
  {
    branch: "Mage Branch",
    jobs: [
      { name: "High Wizard", emoji: "🔮", color: "var(--color-wizard)" },
      { name: "Scholar (Professor)", emoji: "📖", color: "var(--color-priest)" }
    ]
  },
  {
    branch: "Archer Branch",
    jobs: [
      { name: "Sniper", emoji: "🏹", color: "var(--color-sniper)" },
      { name: "Minstrel (Clown)", emoji: "🎵", color: "var(--color-priest)" },
      { name: "Gypsy", emoji: "💃", color: "var(--color-priest)" }
    ]
  },
  {
    branch: "Thief Branch",
    jobs: [
      { name: "Assassin Cross", emoji: "🔪", color: "var(--color-assassin)" },
      { name: "Stalker", emoji: "🎭", color: "var(--color-assassin)" }
    ]
  },
  {
    branch: "Merchant Branch",
    jobs: [
      { name: "Mastersmith (Whitesmith)", emoji: "🔨", color: "var(--color-blacksmith)" },
      { name: "Biochemist (Creator)", emoji: "🧪", color: "var(--color-blacksmith)" }
    ]
  },
  {
    branch: "Doram Branch",
    jobs: [
      { name: "Summoner", emoji: "🐱", color: "var(--color-doram)" }
    ]
  }
];
