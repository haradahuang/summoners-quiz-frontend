import React, { useState, useEffect } from 'react';
import { DEFAULT_TITLE, DEFAULT_BG } from './config';

// ==========================================
// 🛡️ 錯誤攔截組件
// ==========================================
export class ErrorBoundary extends React.Component<any, { hasError: boolean, errorMsg: string }> {
  constructor(props: any) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, errorMsg: error.toString() }; }
  render() {
    if (this.state.hasError) return (<div style={{ padding: '2rem', color: '#e74c3c' }}><h2>❌ 致命錯誤</h2><p>{this.state.errorMsg}</p><button onClick={() => window.location.reload()}>重啟</button></div>);
    return this.props.children;
  }
}

// ==========================================
// 🎨 全域大佈局組件
// ==========================================
export const PageLayout = ({ title, bgImg, children }: { title?: string, bgImg?: string, children: React.ReactNode }) => {
  const finalBg = bgImg === 'LOADING' ? null : ((bgImg && bgImg.trim() !== '') ? bgImg : DEFAULT_BG);
  const displayTitle = title !== undefined ? title : DEFAULT_TITLE; 
  
  const gradient = finalBg 
    ? `radial-gradient(circle at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.9) 100%)`
    : `radial-gradient(circle at center, rgba(15,18,28,1) 0%, rgba(5,5,10,1) 100%)`;

  return (
    <div className="page-layout-wrapper" style={{ backgroundImage: finalBg ? `${gradient}, url("${finalBg}")` : gradient }}>
      {displayTitle !== "" && bgImg !== 'LOADING' && (
        <div className="title-wrapper" style={{ textAlign: 'center', marginBottom: '1vh' }}>
          <h1 className="text-glow" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', margin: 0, padding: '0 20px', letterSpacing: '2px' }}>
            {displayTitle}
          </h1>
        </div>
      )}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {children}
      </div>
    </div>
  );
};

// ==========================================
// 🏆 排行榜組件
// ==========================================
let globalLastLeaderboard: any[] = [];
export const LeaderboardView = ({ data }: { data: any[] }) => {
  const top5Data = data.slice(0, 5);
  
  const [displayRanks, setDisplayRanks] = useState(() => {
    return top5Data.map((player) => {
      const oldIndex = globalLastLeaderboard.findIndex(p => p.username === player.username);
      return { ...player, currentIdx: oldIndex !== -1 ? oldIndex : top5Data.length, opacity: oldIndex !== -1 ? 1 : 0 };
    });
  });

  useEffect(() => {
    const timer = setTimeout(() => { setDisplayRanks(top5Data.map((player, idx) => ({ ...player, currentIdx: idx, opacity: 1 }))); globalLastLeaderboard = top5Data; }, 50);
    return () => clearTimeout(timer);
  }, [data]); // eslint-disable-line

  return (
    <div style={{ position: 'relative', height: `${top5Data.length * 60}px`, transition: 'height 0.3s', marginBottom: '10px' }}>
      {displayRanks.map((player) => {
        const idx = player.currentIdx; const finalIdx = top5Data.findIndex(p => p.username === player.username); 
        const isTop3 = finalIdx < 3; const rankColors = ['#FFD700', '#bdc3c7', '#e67e22']; const rankColor = isTop3 ? rankColors[finalIdx] : '#444';
        const fontSize = finalIdx === 0 ? '1.4rem' : finalIdx === 1 ? '1.2rem' : finalIdx === 2 ? '1.1rem' : '1rem';
        return (
          <div key={player.username} style={{ position: 'absolute', top: `${idx * 60}px`, left: 0, width: '100%', height: '50px', opacity: player.opacity, transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1.5rem', background: 'rgba(20, 30, 48, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '10px', borderLeft: `6px solid ${rankColor}`, boxShadow: '0 4px 15px rgba(0,0,0,0.5)', zIndex: 5 - finalIdx }}>
            <span title={player.username} style={{ color: isTop3 ? rankColor : '#FFF', fontSize, fontWeight: isTop3 ? '900' : 'bold', transition: 'all 0.5s', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', paddingRight: '10px' }}>#{finalIdx + 1} {player.username}</span>
            <span style={{ color: isTop3 ? rankColor : '#FFD700', fontSize, fontWeight: isTop3 ? '900' : 'bold', transition: 'all 0.5s', flexShrink: 0, textShadow: '1px 1px 2px #000' }}>{player.score} 分</span>
          </div>
        );
      })}
    </div>
  );
};
