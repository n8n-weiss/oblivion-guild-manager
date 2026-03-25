import React, { useState } from 'react';
import Icon from '../ui/icons';

const GATEWAYS = [
  { id: 'gcash', label: 'GCash', color: '#005CE6', gradient: 'linear-gradient(135deg, #005CE6, #003699)', qrFile: '/gcash-qr.png' },
  { id: 'maya', label: 'Maya', color: '#13B162', gradient: 'linear-gradient(135deg, #13B162, #0b7841)', qrFile: '/maya-qr.png' },
  { id: 'gotyme', label: 'GoTyme', color: '#00D1FF', gradient: 'linear-gradient(135deg, #00D1FF, #0093b3)', qrFile: '/gotyme-qr.png' },
  { id: 'maribank', label: 'MariBank', color: '#FF7B00', gradient: 'linear-gradient(135deg, #FF7B00, #b35600)', qrFile: '/maribank-qr.png' }
];

export default function TreasuryModal({ onClose }) {
  const [selectedGateway, setSelectedGateway] = useState(GATEWAYS[0]);
  const basePath = window.location.hostname === "localhost" ? "" : "/oblivion-guild-manager";

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: '540px', background: 'var(--bg-card)', position: 'relative', overflow: 'hidden' }}
      >
        {/* Ambient Glows tied to selected gateway color */}
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: `radial-gradient(circle, ${selectedGateway.color}33 0%, transparent 70%)`, pointerEvents: 'none', transition: 'background 0.3s' }} />
        <div style={{ position: 'absolute', bottom: '-100px', left: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(240,192,64,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div className="modal-header" style={{ padding: '24px 32px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(240,192,64,0.15), rgba(240,192,64,0.05))',
              border: '1px solid rgba(240,192,64,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold)', fontSize: '20px',
              boxShadow: '0 4px 12px rgba(240,192,64,0.2)'
            }}>
              <Icon name="trophy" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', textShadow: '0 0 10px rgba(255,255,255,0.2)', margin: 0 }}>BUY ME A BEER!</h2>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>Support OBLIVION Portal and server maintenance</div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '20px' }}>
            <Icon name="close" />
          </button>
        </div>

        {/* Content */}
        <div className="modal-body" style={{ padding: '28px 32px' }}>

          <div style={{
            background: 'rgba(13,16,23,0.5)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)',
            marginBottom: '20px'
          }}>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '16px' }}>
              Select Payment Method
            </div>

            {/* Gateway Selector Tabs */}
            <div style={{
              display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap', justifyContent: 'center',
              background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {GATEWAYS.map(gw => (
                <button
                  key={gw.id}
                  onClick={() => setSelectedGateway(gw)}
                  style={{
                    background: selectedGateway.id === gw.id ? gw.gradient : 'transparent',
                    color: selectedGateway.id === gw.id ? '#fff' : 'var(--text-muted)',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: selectedGateway.id === gw.id ? `0 4px 12px ${gw.color}40` : 'none',
                  }}
                >
                  {gw.label}
                </button>
              ))}
            </div>

            {/* Dynamic QR Code Area */}
            <div style={{
              width: '220px', height: '220px',
              background: '#fff',
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '20px',
              position: 'relative',
              boxShadow: `0 12px 32px ${selectedGateway.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column',
              transition: 'box-shadow 0.3s'
            }}>
              <img
                src={`${basePath}${selectedGateway.qrFile}`}
                alt={`${selectedGateway.label} QR Code`}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  {/* Fallback pattern if image is missing */ }
                  e.target.onerror = null;
                  e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MissingImage_Put_${selectedGateway.qrFile}_In_Public_Folder`;
                  e.target.style.opacity = 0.15;
                }}
              />
              {/* Optional Empty State Text if image fails */}
              <div style={{ position: 'absolute', color: '#222', fontSize: '14px', fontWeight: 800, textAlign: 'center', padding: '0 10px', textTransform: 'uppercase', pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0 }}>
                PLACE <span style={{ color: selectedGateway.color }}>{selectedGateway.label}</span> QR<br />IMAGE HERE
              </div>
            </div>

            <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '4px' }}>
              Scan with your {selectedGateway.label} App
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Scan the QR code above to transfer directly.
            </div>
          </div>

          {/* Perks / Info */}
          <div style={{
            background: 'rgba(240,192,64,0.05)',
            border: '1px solid rgba(240,192,64,0.15)',
            borderRadius: '12px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ color: 'var(--gold)', marginTop: '2px' }}><Icon name="star" /></div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)', marginBottom: '4px' }}>Supporter Perks</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  Contributors receive the <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Oblivion Patron</span> badge to your OBLIVION Portal Profile. Please DM your transfer screenshot to @Ꮤ 𐌄 𐌉 𐌔 𐌔 on Discord to claim your badge!
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
