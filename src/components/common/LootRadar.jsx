import React, { useMemo } from 'react';
import { useGuild } from '../../context/GuildContext';

const LootRadar = () => {
  const { members, auctionWishlist } = useGuild();

  const activeMembers = useMemo(() => members.filter(m => (m.status || "active") === "active"), [members]);

  const wishlistRadar = useMemo(() => {
     let cardAlbumCount = 0;
     let ldCount = 0;
     const albumMembers = [];
     const ldMembers = [];

     auctionWishlist.forEach(entry => {
       const member = activeMembers.find(m => m.memberId === entry.id);
       if (!member) return;
       const bids = entry.bids || [];
       if (bids.some(b => b.type === "Card Album")) {
         cardAlbumCount++;
         albumMembers.push(member.ign);
       }
       if (bids.some(b => b.type === "Light & Dark")) {
         ldCount++;
         ldMembers.push(member.ign);
       }
     });

     return [
       { type: "Card Album", icon: "🃏", count: cardAlbumCount, members: albumMembers },
       { type: "Light & Dark", icon: "✨", count: ldCount, members: ldMembers }
     ].filter(w => w.count > 0).sort((a,b) => b.count - a.count);
  }, [auctionWishlist, activeMembers]);

  return (
    <div className="card" style={{
      border: "1px solid rgba(255,255,255,0.05)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(10, 15, 25, 0.6) 100%)",
      backdropFilter: "blur(12px)",
      boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      transition: "transform 0.2s ease, box-shadow 0.2s ease"
    }}>
      <div className="card-title flex justify-between items-center">
        <span style={{ textShadow: "0 0 10px rgba(255,255,255,0.3)" }}>⭐ Active Loot Wishlist</span>
        <span style={{ fontSize: 11, fontWeight: "normal", color: "var(--text-muted)", background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)" }}>Live Radar</span>
      </div>
      <div className="text-xs text-muted mt-1 mb-4">Items currently requested by members on their active wishlist.</div>

      <div className="flex flex-col gap-3">
         {wishlistRadar.length > 0 ? wishlistRadar.map(w => (
            <div key={w.type} className="p-3 rounded border border-white border-opacity-5" style={{
              background: "rgba(0,0,0,0.4)",
              transition: "background 0.2s ease, transform 0.2s ease",
              cursor: "default"
            }}>
               <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 18, filter: "drop-shadow(0 0 5px gold)" }}>{w.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: "bold", color: "var(--gold)", textShadow: "0 0 8px rgba(240,192,64,0.4)" }}>{w.type}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: 16, fontWeight: "bold", color: "var(--text-primary)" }}>{w.count}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4, textTransform: "uppercase" }}>Demand</span>
                  </div>
               </div>
               <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4, wordWrap: "break-word" }}>
                 <span className="text-muted">Requested by: </span> {w.members.join(", ")}
               </div>
            </div>
         )) : (
            <div className="text-center text-sm text-muted py-6">No items currently on wishlist.</div>
         )}
      </div>
    </div>
  );
};

export default LootRadar;
