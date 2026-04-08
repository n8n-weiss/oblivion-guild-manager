import React from 'react';
import { useGuild } from '../../context/GuildContext';

export function NotificationCenter({ isOpen, onClose }) {
  const { notifications, myMemberId, markNotifRead } = useGuild();
  const [tab, setTab] = React.useState(() => localStorage.getItem("notifications_tab") || "all"); // all | mine | system
  const [visibleCount, setVisibleCount] = React.useState(50);

  const myNotifs = React.useMemo(
    () => notifications.filter(n => n.targetId === "all" || n.targetId === myMemberId),
    [notifications, myMemberId]
  );
  const filteredNotifs = React.useMemo(() => {
    if (tab === "mine") return myNotifs.filter(n => n.targetId === myMemberId);
    if (tab === "system") return myNotifs.filter(n => n.targetId === "all");
    return myNotifs;
  }, [myNotifs, myMemberId, tab]);
  const visibleNotifs = filteredNotifs.slice(0, visibleCount);

  React.useEffect(() => {
    if (!isOpen) return;
    setVisibleCount(50);
  }, [isOpen, tab]);
  React.useEffect(() => {
    localStorage.setItem("notifications_tab", tab);
  }, [tab]);

  const markVisibleAsRead = async () => {
    const unreadTargeted = visibleNotifs.filter(n => !n.isRead && n.targetId !== "all");
    await Promise.all(unreadTargeted.map(n => markNotifRead(n.id)));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div 
        className="fixed top-20 right-4 w-80 z-[101] card animate-slide-in-right shadow-2xl overflow-hidden" 
        style={{ maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}
      >
        <div className="p-4 border-b border-white/5 flex justify-between items-center bg-card2">
          <div>
            <h3 className="font-cinzel text-sm font-bold tracking-wider">NOTIFICATIONS</h3>
            <div className="flex gap-1 mt-2">
              <button className={`btn btn-xs ${tab === "all" ? "" : "btn-ghost"}`} onClick={() => setTab("all")}>All</button>
              <button className={`btn btn-xs ${tab === "mine" ? "" : "btn-ghost"}`} onClick={() => setTab("mine")}>Mine</button>
              <button className={`btn btn-xs ${tab === "system" ? "" : "btn-ghost"}`} onClick={() => setTab("system")}>System</button>
            </div>
          </div>
          <button className="text-muted hover:text-white transition-colors" onClick={onClose}>✕</button>
        </div>
        
        <div className="overflow-y-auto p-2 flex flex-col gap-2 custom-scrollbar">
          {filteredNotifs.length === 0 && (
            <div className="text-center p-12 text-muted text-xs italic">
              No messages in your inbox.
            </div>
          )}
          {visibleNotifs.map(n => (
            <div 
              key={n.id} 
              className={`p-3 rounded-xl border transition-all cursor-pointer hover:bg-white/5 ${
                n.isRead ? 'bg-black/20 border-white/5 opacity-60' : 'bg-accent/10 border-accent/30 shadow-[0_0_15px_rgba(99,130,230,0.1)]'
              }`}
              onClick={() => markNotifRead(n.id)}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-[13px]" style={{ 
                  color: n.type === 'warning' ? 'var(--red)' : 
                         n.type === 'success' ? 'var(--green)' : 
                         n.type === 'gold' ? 'var(--gold)' : 'var(--accent)' 
                }}>
                  {n.title}
                </span>
                <span className="text-[9px] text-muted whitespace-nowrap ml-2">
                  {new Date(n.ts).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p className="text-[11px] text-secondary leading-normal">{n.message}</p>
              {!n.isRead && n.targetId !== "all" && (
                <div className="flex justify-end mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                </div>
              )}
            </div>
          ))}
          {filteredNotifs.length > visibleNotifs.length && (
            <div className="text-center py-2">
              <button className="btn btn-ghost btn-sm" onClick={() => setVisibleCount(v => v + 50)}>
                Load more
              </button>
            </div>
          )}
        </div>
        
        {visibleNotifs.length > 0 && (
          <div className="p-3 text-center border-t border-white/5 bg-black/20">
            <button className="text-[10px] text-muted hover:text-accent transition-colors uppercase tracking-widest font-bold" onClick={markVisibleAsRead}>
              Mark visible as read
            </button>
          </div>
        )}
      </div>
    </>
  );
}
