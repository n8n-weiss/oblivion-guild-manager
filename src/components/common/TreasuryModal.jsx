import React, { useState } from 'react';
import { motion } from 'framer-motion';
const MotionDiv = motion.div;
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
    <MotionDiv 
      className="modal-overlay" 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose} 
      style={{ zIndex: 9999 }}
    >
      <MotionDiv
        className="glass-panel relative overflow-hidden"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        style={{ 
          width: '100%', 
          maxWidth: '540px', 
          borderRadius: '24px',
          padding: 0,
          border: '1px solid rgba(240,192,64,0.3)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8), inset 0 0 40px rgba(240,192,64,0.05)'
        }}
      >
        {/* Animated Gold Border Shimmer */}
        <div className="absolute inset-0 pointer-events-none" style={{ padding: '1px' }}>
          <div className="w-full h-full rounded-[23px] border border-transparent" style={{ 
            background: 'linear-gradient(90deg, transparent, rgba(240,192,64,0.4), transparent)',
            backgroundSize: '200% 100%',
            animation: 'gold-shimmer 3s linear infinite',
            opacity: 0.5
          }} />
        </div>

        {/* Ambient Glows tied to selected gateway color */}
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: `radial-gradient(circle, ${selectedGateway.color}33 0%, transparent 70%)`, pointerEvents: 'none', transition: 'background 0.3s' }} />
        <div style={{ position: 'absolute', bottom: '-100px', left: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(240,192,64,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Header */}
        <div className="modal-header" style={{ padding: '32px 32px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(240,192,64,0.2), rgba(240,192,64,0.05))',
              border: '1px solid rgba(240,192,64,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold)', fontSize: '24px',
              boxShadow: '0 8px 20px rgba(240,192,64,0.2)'
            }}>
              <Icon name="trophy" />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Cinzel,serif', fontSize: '24px', fontWeight: 900, color: '#fff', textShadow: '0 0 15px rgba(240,192,64,0.3)', margin: 0, letterSpacing: '1px' }}>BUY ME A BEER!</h2>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', letterSpacing: '0.5px', marginTop: '2px', fontWeight: 500 }}>Support OBLIVION Portal and server maintenance</div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" />
          </button>
        </div>

        {/* Content */}
        <div className="modal-body" style={{ padding: '32px' }}>

          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '20px',
            padding: '28px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.4)',
            marginBottom: '24px'
          }}>

            <div style={{ fontSize: '12px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 800, marginBottom: '20px', opacity: 0.8 }}>
              Select Payment Method
            </div>

            {/* Gateway Selector Tabs */}
            <div style={{
              display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap', justifyContent: 'center',
              background: 'rgba(0,0,0,0.4)', padding: '6px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.05)'
            }}>
              {GATEWAYS.map(gw => (
                <button
                  key={gw.id}
                  onClick={() => setSelectedGateway(gw)}
                  style={{
                    background: selectedGateway.id === gw.id ? gw.gradient : 'transparent',
                    color: selectedGateway.id === gw.id ? '#fff' : 'var(--text-secondary)',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: selectedGateway.id === gw.id ? `0 8px 20px ${gw.color}50` : 'none',
                    transform: selectedGateway.id === gw.id ? 'scale(1.05)' : 'scale(1)'
                  }}
                >
                  {gw.label}
                </button>
              ))}
            </div>

            {/* Dynamic QR Code Area */}
            <div style={{
              width: '240px', height: '240px',
              background: '#fff',
              borderRadius: '20px',
              padding: '16px',
              marginBottom: '24px',
              position: 'relative',
              boxShadow: `0 20px 50px ${selectedGateway.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              transform: 'rotate(-1deg)'
            }}>
              <img
                src={`${basePath}${selectedGateway.qrFile}`}
                alt={`${selectedGateway.label} QR Code`}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MissingImage_Put_${selectedGateway.qrFile}_In_Public_Folder`;
                  e.target.style.opacity = 0.15;
                }}
              />
            </div>

            <div style={{ fontSize: '16px', color: '#fff', fontWeight: 700, marginBottom: '6px' }}>
              Scan with your {selectedGateway.label} App
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '280px', lineHeight: 1.5 }}>
              Use your mobile banking app to scan the QR code above for a direct transfer.
            </div>
          </div>

          {/* Perks / Info */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(240,192,64,0.1), rgba(240,192,64,0.02))',
            border: '1px solid rgba(240,192,64,0.2)',
            borderRadius: '18px',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden'
          }}>
             <div className="absolute top-0 right-0 p-2 opacity-10" style={{ fontSize: '40px' }}><Icon name="star" /></div>
            <div style={{ display: 'flex', gap: '14px', position: 'relative', zIndex: 1 }}>
              <div style={{ color: 'var(--gold)', marginTop: '2px', fontSize: '18px' }}><Icon name="star" /></div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--gold)', marginBottom: '6px', letterSpacing: '0.5px' }}>SUPPORTER PERKS</div>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                  Contributors receive the <span style={{ color: 'var(--gold)', fontWeight: 800, textShadow: '0 0 8px rgba(240,192,64,0.4)' }}>OBLIVION PATRON</span> badge on your profile. Please DM your transfer screenshot to <span style={{ color: '#fff', fontWeight: 700 }}>@Ꮤ 𐌄 𐌉 𐌔 𐌔</span> on Discord to claim your badge!
                </div>
              </div>
            </div>
          </div>

        </div>
      </MotionDiv>
    </MotionDiv>
  );
}
