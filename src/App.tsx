import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './index.css';

const API_URL = 'https://swtest-pgq8.onrender.com/api';
const socket: Socket = io('https://swtest-pgq8.onrender.com');

// ==========================================
// 🎵 全域音效引擎
// ==========================================
const sfx: Record<string, HTMLAudioElement> = {
  bgm: new Audio('https://incompetech.com/music/royalty-free/mp3-royaltyfree/Sneaky%20Snitch.mp3'),
  tick: new Audio('https://actions.google.com/sounds/v1/ui/button_click.ogg'),
  correct: new Audio('https://cdn.pixabay.com/download/audio/2021/08/04/audio_bb630cc098.mp3'),
  wrong: new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'),
  victory: new Audio('https://incompetech.com/music/royalty-free/mp3-royaltyfree/Happy%20Happy%20Game%20Show.mp3'),
  cheer: new Audio('https://actions.google.com/sounds/v1/crowds/crowd_cheering.ogg')
};

Object.values(sfx).forEach(audio => { audio.preload = 'auto'; });
sfx.bgm.loop = true;
sfx.victory.loop = true;

const unlockAudio = () => {
  const originalVolumes: Record<string, number> = { bgm: 0.3, tick: 0.6, correct: 0.8, wrong: 0.8, victory: 0.5, cheer: 0.8 };
  Object.keys(sfx).forEach(key => {
    const audio = sfx[key];
    audio.volume = 0.01; 
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = originalVolumes[key]; 
    }).catch(() => {});
  });
  setTimeout(() => { sfx.bgm.volume = 0.3; sfx.bgm.play().catch(()=>{}); }, 100);
};

class ErrorBoundary extends React.Component<any, { hasError: boolean, errorMsg: string }> {
  constructor(props: any) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, errorMsg: error.toString() }; }
  render() {
    if (this.state.hasError) return (<div style={{ padding: '2rem', color: '#e74c3c' }}><h2>❌ 致命錯誤</h2><p>{this.state.errorMsg}</p><button onClick={() => window.location.reload()}>重啟</button></div>);
    return this.props.children;
  }
}

const topColors: Record<string, string> = { 'T1': '#e74c3c', 'T2': '#3498db', 'T3': '#f1c40f', 'T4': '#9b59b6' };

// ==========================================
// 🏆 動態洗牌排行榜引擎
// ==========================================
let globalLastLeaderboard: any[] = [];
const LeaderboardView = ({ data }: { data: any[] }) => {
  const [displayRanks, setDisplayRanks] = useState(() => {
    return data.map((player) => {
      const oldIndex = globalLastLeaderboard.findIndex(p => p.username === player.username);
      return { ...player, currentIdx: oldIndex !== -1 ? oldIndex : data.length, opacity: oldIndex !== -1 ? 1 : 0 };
    });
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayRanks(data.map((player, idx) => ({ ...player, currentIdx: idx, opacity: 1 })));
      globalLastLeaderboard = data; 
    }, 50);
    return () => clearTimeout(timer);
  }, [data]);

  return (
    <div style={{ position: 'relative', height: `${data.length * 70}px`, transition: 'height 0.3s', marginBottom: '20px' }}>
      {displayRanks.map((player) => {
        const idx = player.currentIdx; const finalIdx = data.findIndex(p => p.username === player.username); 
        const isTop3 = finalIdx < 3; const rankColors = ['#FFD700', '#bdc3c7', '#e67e22']; const rankColor = isTop3 ? rankColors[finalIdx] : '#444';
        const fontSize = finalIdx === 0 ? '1.6rem' : finalIdx === 1 ? '1.4rem' : finalIdx === 2 ? '1.2rem' : '1.05rem';
        const fontWeight = isTop3 ? '900' : 'bold';
        
        return (
          <div key={player.username} style={{ 
            position: 'absolute', top: `${idx * 70}px`, left: 0, width: '100%', height: '60px', opacity: player.opacity,
            transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0 1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: `5px solid ${rankColor}`, zIndex: 20 - finalIdx
          }}>
            <span style={{ color: isTop3 ? rankColor : '#FFF', fontSize, fontWeight, transition: 'all 0.5s' }}>#{finalIdx + 1} {player.username}</span>
            <span style={{ color: isTop3 ? rankColor : '#FFD700', fontSize, fontWeight, transition: 'all 0.5s' }}>{player.score} 分</span>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 🎮 玩家端介面 (Player View)
// ==========================================
function PlayerApp() {
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [podiumData, setPodiumData] = useState<any[] | null>(null);

  const [activeTopId, setActiveTopId] = useState<string | null>(null);
  const [userMatches, setUserMatches] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isJoined && !podiumData) { sfx.victory.pause(); sfx.bgm.play().catch(()=>{}); }
    if (podiumData) { sfx.bgm.pause(); sfx.victory.currentTime = 0; sfx.victory.play().catch(()=>{}); sfx.cheer.currentTime = 0; sfx.cheer.play().catch(()=>{}); }
  }, [isJoined, podiumData]);

  useEffect(() => {
    if (answerResult) {
      if (answerResult.isCorrect) { sfx.correct.currentTime = 0; sfx.correct.play().catch(()=>{}); }
      else { sfx.wrong.currentTime = 0; sfx.wrong.play().catch(()=>{}); }
    }
  }, [answerResult]);

  useEffect(() => {
    socket.on('update_players', (list) => setPlayers(list || []));
    socket.on('receive_question', (q) => { 
      if (q.type === 'match' && q.bottomItems) q.bottomItems = q.bottomItems.sort(() => Math.random() - 0.5);
      setCurrentQuestion(q); setTimeLeft(q?.timeLimit || 15); setHasAnswered(false); 
      setAnswerResult(null); setLeaderboard(null); setReviewData(null); setPodiumData(null); 
      setUserMatches({}); setActiveTopId(null); 
    });
    socket.on('answer_result', setAnswerResult);
    socket.on('leaderboard_updated', setLeaderboard);
    socket.on('review_updated', (data) => { setReviewData(data); setLeaderboard(null); });
    socket.on('podium_updated', (top3) => { setPodiumData(top3); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });
    socket.on('join_error', (msg) => { alert(msg); setIsJoined(false); });
    return () => { socket.off(); };
  }, []);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (currentQuestion && timeLeft > 0 && !hasAnswered && !leaderboard && !reviewData && !podiumData) {
      timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000); 
      if (timeLeft <= 5) { sfx.tick.currentTime = 0; sfx.tick.play().catch(()=>{}); }
    } else { sfx.tick.pause(); }

    if (timeLeft === 0 && currentQuestion && !hasAnswered) {
      setHasAnswered(true); socket.emit('submit_answer', { pin, answerData: currentQuestion?.type === 'match' ? userMatches : '' });
    }
    return () => clearTimeout(timerId);
  }, [currentQuestion, timeLeft, hasAnswered, leaderboard, reviewData, podiumData]);

  const handleJoinArena = () => { if (username.trim() && pin.trim()) { socket.emit('join_room', { pin, username }); setIsJoined(true); unlockAudio(); } };
  const handleChoiceClick = (answerId: string) => { if (!hasAnswered) { setHasAnswered(true); socket.emit('submit_answer', { pin, answerData: answerId }); } };
  const handleMatchSubmit = () => { if (!hasAnswered) { setHasAnswered(true); socket.emit('submit_answer', { pin, answerData: userMatches }); } };
  const handleTopClick = (id: string) => { setActiveTopId(id === activeTopId ? null : id); setUserMatches(prev => { const newMatches = { ...prev }; if (newMatches[id]) delete newMatches[id]; return newMatches; }); };
  const handleBottomClick = (bottomId: string) => { setUserMatches(prev => { const newMatches = { ...prev }; let existingTopKey = null; for (const key in newMatches) { if (newMatches[key] === bottomId) existingTopKey = key; } if (activeTopId) { if (existingTopKey) delete newMatches[existingTopKey]; newMatches[activeTopId] = bottomId; setActiveTopId(null); } else { if (existingTopKey) delete newMatches[existingTopKey]; } return newMatches; }); };

  const sortedPlayers = [...(players || [])].sort((a, b) => b.score - a.score);
  const myRankIndex = sortedPlayers.findIndex(p => p.username === username);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '-';
  const myScore = players.find(p => p.username === username)?.score || 0;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {!isJoined && (
        <div className="game-panel" style={{ maxWidth: '400px' }}>
          <h2 style={{ color: '#FFD700', marginBottom: '1rem' }}>進入競技場</h2>
          <input type="text" placeholder="房間代碼 (PIN)" value={pin} onChange={(e) => setPin(e.target.value)} className="game-input" disabled={!!searchParams.get('pin')} />
          <input type="text" placeholder="您的暱稱" value={username} onChange={(e) => setUsername(e.target.value)} className="game-input" />
          <button className="btn-summon" onClick={handleJoinArena}>準備戰鬥</button>
        </div>
      )}

      {isJoined && !currentQuestion && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel" style={{ maxWidth: '400px' }}>
          <h2 style={{ color: '#FFD700', fontSize: '1.8rem', marginBottom: '1rem' }}>房號: {pin}</h2>
          <p style={{ fontSize: '1.3rem', color: '#3498db' }}>等待大師開啟試煉...</p>
          <p style={{ color: '#bdc3c7', marginTop: '1rem' }}>已進場: {(players || []).length} 人</p>
        </div>
      )}

      {isJoined && currentQuestion && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel question-transition" key={currentQuestion.id}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1c40f', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '15px', borderBottom: '1px solid rgba(255,215,0,0.3)', paddingBottom: '8px' }}>
            <span>👤 {username}</span><span>🏆 積分: {myScore} | 🏅 排名: {myRank}</span>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ color: '#34db98', fontSize: '1rem', marginBottom: '5px', fontWeight: 'bold' }}>戰局進度: {currentQuestion?.currentQIndex || 1} / {currentQuestion?.totalQuestions || 1}</p>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
              <div style={{ height: '100%', background: '#FFD700', width: `${((currentQuestion?.currentQIndex || 1) / (currentQuestion?.totalQuestions || 1)) * 100}%`, transition: 'width 0.5s', borderRadius: '3px' }} />
            </div>
          </div>
          <h2 style={{ color: '#FFF', fontSize: '1.3rem', marginBottom: '1rem' }}>{currentQuestion?.text}</h2>
          <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ height: '100%', background: timeLeft <= 5 ? '#e74c3c' : '#2ecc71', width: `${(timeLeft / (currentQuestion?.timeLimit || 15)) * 100}%`, transition: 'width 1s linear' }} />
          </div>

          {currentQuestion?.type === 'choice' && !hasAnswered && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(currentQuestion?.options || []).map((opt: any, idx: number) => (
                <button key={opt?.id || idx} onClick={() => handleChoiceClick(opt?.id)} style={{ padding: '1rem', fontSize: '1.1rem', color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', border: 'none', borderLeft: `6px solid ${opt?.color || '#fff'}`, cursor: 'pointer' }}>{opt?.text}</button>
              ))}
            </div>
          )}

          {currentQuestion?.type === 'match' && !hasAnswered && (
            <div>
              <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '10px' }}>💡 點擊上方魔靈，再點下方圖片來配對</p>
              <div className="match-grid">
                {(currentQuestion?.topItems || []).map((item: any, idx: number) => {
                  const isActive = activeTopId === item?.id; const isMatched = Boolean(userMatches?.[item?.id]); const itemColor = topColors[item?.id] || '#fff';
                  return (
                    <div key={item?.id || idx} onClick={() => handleTopClick(item?.id)} className={`match-item ${isActive ? 'active' : ''}`} style={{ borderColor: isActive || isMatched ? itemColor : 'transparent' }}>
                      {item?.img && <img src={item.img} alt="top" referrerPolicy="no-referrer" crossOrigin="anonymous" />}
                      <p>{item?.name || `目標 ${idx+1}`}</p>
                      {isMatched && <div className="match-badge" style={{ background: itemColor }}>✓</div>}
                    </div>
                  );
                })}
              </div>
              <div className="match-grid">
                {(currentQuestion?.bottomItems || []).map((item: any, idx: number) => {
                  let matchedTopId: string | null = null;
                  if (userMatches) { for (const k in userMatches) { if (userMatches[k] === item?.id) matchedTopId = k; } }
                  return (
                    <div key={item?.id || idx} onClick={() => handleBottomClick(item?.id)} className="match-item" style={{ borderColor: matchedTopId ? topColors[matchedTopId] : 'transparent' }}>
                      {item?.img && <img src={item.img} alt="bottom" referrerPolicy="no-referrer" crossOrigin="anonymous" />}
                      {matchedTopId && <div className="match-badge" style={{ background: topColors[matchedTopId] || '#fff' }}>✓</div>}
                    </div>
                  );
                })}
              </div>
              <button className="btn-summon" onClick={handleMatchSubmit} disabled={Object.keys(userMatches || {}).length !== (currentQuestion?.topItems?.length || 4)} style={{ marginTop: '10px' }}>
                {Object.keys(userMatches || {}).length === (currentQuestion?.topItems?.length || 4) ? '確認送出配對！' : '請完成所有配對...'}
              </button>
            </div>
          )}
          {answerResult && (
            <div style={{ animation: 'bounceIn 0.8s ease', marginTop: '1rem' }}>
              <h3 style={{ fontSize: '2rem', color: answerResult?.isCorrect ? '#2ecc71' : '#e74c3c' }}>{answerResult?.isCorrect ? `✨ 答對了！ +${answerResult?.earnedScore}` : '💀 殘念...'}</h3>
            </div>
          )}
        </div>
      )}

      {isJoined && leaderboard && !reviewData && !podiumData && (
         <div className="game-panel">
           <h2 style={{ color: '#FFD700', fontSize: '2rem', marginBottom: '1.5rem' }}>🏆 排名結算</h2>
           <LeaderboardView data={leaderboard} />
         </div>
      )}

      {isJoined && reviewData && (
        <div className="game-panel">
          <h2 style={{ color: '#3498db', fontSize: '1.8rem', marginBottom: '1rem' }}>正確答案</h2>
          {reviewData?.question?.type === 'choice' ? (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               {(reviewData?.question?.options || []).map((opt: any, idx: number) => {
                 const isCorrect = opt?.id === reviewData?.question?.correctAnswer;
                 return (
                   <div key={opt?.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: isCorrect ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.05)', border: isCorrect ? '2px solid #2ecc71' : '1px solid #444', borderRadius: '8px' }}>
                     <span style={{ color: isCorrect ? '#2ecc71' : '#fff' }}>{isCorrect && '✔️ '} {opt?.text}</span><span style={{ color: '#bdc3c7' }}>{reviewData?.stats?.[opt?.id] || 0} 人</span>
                   </div>
                 );
               })}
             </div>
          ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <p style={{ color: '#2ecc71', fontSize: '1.1rem', marginBottom: '10px', fontWeight: 'bold' }}>🎯 正確配對</p>
               {(reviewData?.question?.topItems || []).map((top: any, idx: number) => {
                 const correctBottomId = reviewData?.question?.correctMatches?.[top.id];
                 const bottomItem = reviewData?.question?.bottomItems?.find((b: any) => b.id === correctBottomId);
                 return (
                   <div key={top.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(46, 204, 113, 0.1)', padding: '10px', borderRadius: '10px', border: '1px solid #2ecc71' }}>
                      <div style={{ textAlign: 'center', width: '80px' }}><img src={top.img} alt="top" referrerPolicy="no-referrer" style={{ width: '100%', height: '60px', objectFit: 'contain', background: '#000', borderRadius: '5px' }} /><p style={{ fontSize: '0.8rem', marginTop: '5px', color: '#fff' }}>{top.name}</p></div>
                      <span style={{ fontSize: '1.5rem' }}>🔗</span>
                      <div style={{ textAlign: 'center', width: '80px' }}><img src={bottomItem?.img} alt="bottom" referrerPolicy="no-referrer" style={{ width: '100%', height: '60px', objectFit: 'contain', background: '#000', borderRadius: '5px' }} /></div>
                   </div>
                 );
               })}
             </div>
          )}
        </div>
      )}

      {isJoined && podiumData && (
        <div className="game-panel" style={{ animation: 'bounceIn 1s ease' }}>
          <div className="firework fw-1">🎆</div><div className="firework fw-2">🎇</div><div className="firework fw-3">✨</div><div className="firework fw-4">🎊</div>
          <div className="podium-content">
            <h2 style={{ color: '#FFD700', fontSize: '2.5rem', marginBottom: '2rem', textShadow: '0 0 15px rgba(255,215,0,0.8)' }}>🏆 傳奇誕生 🏆</h2>
            {podiumData?.[0] && <h3 style={{color: '#f1c40f', fontSize: '2.2rem', margin: '20px 0'}}>🥇 {podiumData[0]?.username} <span style={{fontSize:'1.2rem'}}>({podiumData[0]?.score}分)</span></h3>}
            {podiumData?.[1] && <h4 style={{color: '#bdc3c7', fontSize: '1.7rem', margin: '20px 0'}}>🥈 {podiumData[1]?.username} <span style={{fontSize:'1rem'}}>({podiumData[1]?.score}分)</span></h4>}
            {podiumData?.[2] && <h4 style={{color: '#e67e22', fontSize: '1.4rem', margin: '20px 0'}}>🥉 {podiumData[2]?.username} <span style={{fontSize:'0.9rem'}}>({podiumData[2]?.score}分)</span></h4>}
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// 👑 專屬管理端介面 (Admin UI Builder)
// ==========================================
function AdminApp() {
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [quizPacks, setQuizPacks] = useState<any[]>([]);
  const [editingPack, setEditingPack] = useState<any>(null); 
  const [hostingPin, setHostingPin] = useState<string | null>(null);
  const [hostingUrl, setHostingUrl] = useState<string | null>(null);
  
  const [qType, setQType] = useState<'choice' | 'match'>('choice');
  const [newQText, setNewQText] = useState('');
  const [newTime, setNewTime] = useState(15);
  const [newOptA, setNewOptA] = useState(''); const [newOptB, setNewOptB] = useState('');
  const [newOptC, setNewOptC] = useState(''); const [newOptD, setNewOptD] = useState('');
  const [newAns, setNewAns] = useState('A');
  const [matchPairs, setMatchPairs] = useState([
    { tName: '', tImg: '', bImg: '' }, { tName: '', tImg: '', bImg: '' },
    { tName: '', tImg: '', bImg: '' }, { tName: '', tImg: '', bImg: '' }
  ]);

  const [players, setPlayers] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [podiumData, setPodiumData] = useState<any[] | null>(null);

  useEffect(() => {
    if (hostingPin && !podiumData) { sfx.victory.pause(); sfx.bgm.play().catch(()=>{}); }
    if (podiumData) { sfx.bgm.pause(); sfx.victory.currentTime = 0; sfx.victory.play().catch(()=>{}); sfx.cheer.currentTime = 0; sfx.cheer.play().catch(()=>{}); }
  }, [hostingPin, podiumData]);

  useEffect(() => {
    socket.on('room_created', ({ pin, joinUrl }) => { setHostingPin(pin); setHostingUrl(window.location.origin + joinUrl); });
    socket.on('update_players', (list) => setPlayers(list || []));
    socket.on('receive_question', (q) => { setCurrentQuestion(q); setLeaderboard(null); setReviewData(null); setPodiumData(null); });
    socket.on('leaderboard_updated', setLeaderboard);
    socket.on('review_updated', (data) => { setReviewData(data); setLeaderboard(null); }); 
    socket.on('podium_updated', (top3) => { setPodiumData(top3); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });
    return () => { socket.off(); };
  }, []);

  const fetchQuizzes = async (user: string) => {
    try { const res = await fetch(`${API_URL}/quizzes/${user}`); const data = await res.json(); setQuizPacks(data); } 
    catch (e) { console.error('讀取題庫失敗'); }
  };

  const handleAuth = async () => {
    if(!username || !password) return alert('請填寫帳號密碼');
    const endpoint = authMode === 'login' ? '/login' : '/register';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        if(authMode === 'login') { setAdminUser(data.username); fetchQuizzes(data.username); }
        else { alert('註冊成功，請登入！'); setAuthMode('login'); }
      } else alert(data.error);
    } catch (e) { alert('伺服器連線失敗'); }
  };

  const handleHostGame = (packId: string) => { socket.emit('host_create_room', packId); unlockAudio(); };
  const handleDeletePack = async (packId: string) => {
    if (!window.confirm('確定要刪除這個題庫包嗎？此動作無法復原！')) return;
    try { const res = await fetch(`${API_URL}/quizzes/${packId}`, { method: 'DELETE' }); if (res.ok) { alert('🗑️ 題庫包已刪除！'); fetchQuizzes(adminUser!); } } catch (e) { alert('刪除失敗'); }
  };

  const handleCreateNewPack = () => { setEditingPack({ title: '未命名題庫包', author: adminUser, questions: [] }); };
  const handleSavePack = async () => {
    if (!editingPack.title.trim()) return alert('請填寫題庫包名稱！');
    try { const res = await fetch(`${API_URL}/quizzes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editingPack) }); if (res.ok) { alert('💾 題庫包儲存成功！'); setEditingPack(null); fetchQuizzes(adminUser!); } } catch(e) { alert('儲存失敗'); }
  };

  // 👇 新增：檔案上傳轉換機制 (限重 300KB) 👇
  const handleImageUpload = (index: number, field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 300 * 1024) {
      alert(`⚠️ 圖片「${file.name}」檔案太大！\n為了確保遊戲順暢，請壓縮至 300KB 以內再上傳喔！`);
      e.target.value = ''; 
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = event.target?.result as string;
      updateMatchPair(index, field, base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleAddQuestion = () => {
    if (!newQText.trim()) return alert('請填寫題目敘述！');
    let newQ: any = { id: Date.now(), type: qType, text: newQText, timeLimit: newTime };
    
    if (qType === 'choice') {
      if (!newOptA.trim() || !newOptB.trim()) return alert('單選題請至少填寫 A 與 B 兩個選項！');
      const options = [];
      if (newOptA.trim()) options.push({ id: 'A', text: newOptA, color: '#e53e3e' });
      if (newOptB.trim()) options.push({ id: 'B', text: newOptB, color: '#3182ce' });
      if (newOptC.trim()) options.push({ id: 'C', text: newOptC, color: '#d69e2e' });
      if (newOptD.trim()) options.push({ id: 'D', text: newOptD, color: '#805ad5' });
      if (!options.find(o => o.id === newAns)) return alert(`您設定的正解是 ${newAns}，但您沒有填寫該選項的內容！`);
      newQ.correctAnswer = newAns; newQ.options = options;
    } else {
      const isComplete = matchPairs.every(p => p.tName && p.tImg && p.bImg);
      if (!isComplete) return alert('請確保 4 組配對的名字與圖片都已上傳填寫！');
      newQ.topItems = matchPairs.map((p, i) => ({ id: `T${i+1}`, name: p.tName, img: p.tImg }));
      newQ.bottomItems = matchPairs.map((p, i) => ({ id: `B${i+1}`, img: p.bImg }));
      newQ.correctMatches = { 'T1':'B1', 'T2':'B2', 'T3':'B3', 'T4':'B4' };
    }
    setEditingPack({ ...editingPack, questions: [...editingPack.questions, newQ] });
    setNewQText(''); setNewOptA(''); setNewOptB(''); setNewOptC(''); setNewOptD('');
    setMatchPairs([{ tName:'', tImg:'', bImg:'' }, { tName:'', tImg:'', bImg:'' }, { tName:'', tImg:'', bImg:'' }, { tName:'', tImg:'', bImg:'' }]);
  };

  const handleDeleteQuestion = (idToRemove: number) => { setEditingPack({ ...editingPack, questions: editingPack.questions.filter((q: any) => q.id !== idToRemove) }); };
  const updateMatchPair = (index: number, field: string, value: string) => { const newPairs = [...matchPairs]; newPairs[index] = { ...newPairs[index], [field]: value }; setMatchPairs(newPairs); };

  // 👇 返回控制台邏輯 (強制關閉所有音樂) 👇
  const handleReturnToDashboard = () => {
    sfx.victory.pause(); sfx.victory.currentTime = 0;
    sfx.cheer.pause(); sfx.cheer.currentTime = 0;
    sfx.bgm.pause(); sfx.bgm.currentTime = 0;
    
    setHostingPin(null); setHostingUrl(null); setPlayers([]);
    setCurrentQuestion(null); setLeaderboard(null); setReviewData(null); setPodiumData(null);
  };

  if (!adminUser) {
    return (
      <div className="game-panel" style={{ maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ color: '#FFD700', marginBottom: '1rem' }}>🔧 {authMode === 'login' ? '登入創作者後台' : '註冊新帳號'}</h2>
        <input type="text" placeholder="帳號" value={username} onChange={(e) => setUsername(e.target.value)} className="game-input" />
        <input type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} className="game-input" />
        <button className="btn-summon" onClick={handleAuth}>{authMode === 'login' ? '登入' : '註冊'}</button>
        <p style={{ marginTop: '10px', cursor: 'pointer', color: '#3498db' }} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>{authMode === 'login' ? '沒有帳號？點此註冊' : '已有帳號？點此登入'}</p>
      </div>
    );
  }

  if (hostingPin) {
    const isGameStarted = currentQuestion || leaderboard || reviewData || podiumData;
    const answeredCount = players.filter(p => p.hasAnswered).length;

    return (
      <div className="game-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
        {!isGameStarted ? (
          <>
            <h2 style={{ color: '#e74c3c' }}>👑 主持人控場中心</h2>
            <h3 style={{ color: '#f1c40f', fontSize: '2rem' }}>房號: {hostingPin}</h3>
            <p style={{ color: '#2ecc71', margin: '10px 0', wordBreak: 'break-all' }}>玩家加入連結: <br/><a href={hostingUrl!} target="_blank" rel="noreferrer" style={{color: '#3498db'}}>{hostingUrl}</a></p>
            <p>目前進場: {players.length} 人</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center', margin: '10px 0' }}>
              {(players || []).map((p, i) => <span key={i} style={{ background: 'rgba(255,215,0,0.1)', padding: '3px 8px', borderRadius: '5px', fontSize: '0.8rem', color: '#FFD700' }}>{p.username}</span>)}
            </div>
            <hr style={{ borderColor: '#444', margin: '20px 0' }}/>
            <button className="btn-summon" onClick={() => socket.emit('host_send_question', hostingPin)}>▶️ 開始遊戲</button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#bdc3c7', fontSize: '0.9rem', marginBottom: '15px', borderBottom: '1px solid #444', paddingBottom: '10px' }}>
              <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>👑 主持人模式</span>
              <span>房間: {hostingPin} | 進場: {players.length} 人</span>
            </div>

            {currentQuestion && !leaderboard && !reviewData && !podiumData && (
              <div className="question-transition">
                <h3 style={{ color: '#34db98', marginBottom: '10px' }}>⏳ 題目作答中... (已答題: {answeredCount} / {players.length} 人)</h3>
                <div style={{ marginBottom: '1rem' }}><p style={{ color: '#34db98', fontSize: '1rem', marginBottom: '5px', fontWeight: 'bold' }}>戰局進度: {currentQuestion?.currentQIndex || 1} / {currentQuestion?.totalQuestions || 1}</p></div>
                <h2 style={{ color: '#FFF', fontSize: '1.3rem', marginBottom: '1.5rem' }}>{currentQuestion.text}</h2>
                
                {currentQuestion.type === 'choice' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', opacity: 0.8, pointerEvents: 'none' }}>
                    {(currentQuestion.options || []).map((opt: any, idx: number) => (
                      <div key={idx} style={{ padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', borderLeft: `5px solid ${opt.color || '#fff'}`, color: '#fff' }}>{opt.text}</div>
                    ))}
                  </div>
                )}
                {currentQuestion.type === 'match' && (
                  <div style={{ color: '#bdc3c7', fontSize: '0.9rem', opacity: 0.8, pointerEvents: 'none' }}>
                    <p style={{ marginBottom: '10px' }}>[圖片配對題選項]</p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                       {(currentQuestion.topItems || []).map((item: any, idx: number) => (
                         <div key={idx} style={{ background: 'rgba(255,255,255,0.1)', padding: '5px', borderRadius: '5px', color: '#fff', textAlign: 'center' }}>
                           <img src={item.img} alt="top" referrerPolicy="no-referrer" crossOrigin="anonymous" style={{ width: '60px', height: '60px', objectFit: 'contain', background: '#000', borderRadius: '5px', display: 'block' }} /><span style={{ fontSize: '0.8rem' }}>{item.name}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                )}
                <button className="btn-summon" onClick={() => socket.emit('host_show_leaderboard', hostingPin)} style={{ background: '#9b59b6', marginTop: '20px' }}>📊 結算當前排名</button>
              </div>
            )}

            {leaderboard && !reviewData && !podiumData && (
              <div>
                <h2 style={{ color: '#FFD700', fontSize: '2rem', marginBottom: '1.5rem' }}>🏆 排名結算</h2>
                <LeaderboardView data={leaderboard} />
                <button className="btn-summon" onClick={() => socket.emit('host_show_review', hostingPin)} style={{ background: '#34495e', marginTop: '15px' }}>🔍 公佈答案</button>
              </div>
            )}

            {reviewData && (
              <div>
                <h2 style={{ color: '#3498db', fontSize: '1.8rem', marginBottom: '1rem' }}>正確答案</h2>
                {reviewData?.question?.type === 'choice' ? (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                     {(reviewData?.question?.options || []).map((opt: any, idx: number) => {
                       const isCorrect = opt?.id === reviewData?.question?.correctAnswer;
                       return (
                         <div key={opt?.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: isCorrect ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.05)', border: isCorrect ? '2px solid #2ecc71' : '1px solid #444', borderRadius: '8px' }}>
                           <span style={{ color: isCorrect ? '#2ecc71' : '#fff' }}>{isCorrect && '✔️ '} {opt?.text}</span><span style={{ color: '#bdc3c7' }}>{reviewData?.stats?.[opt?.id] || 0} 人</span>
                         </div>
                       );
                     })}
                   </div>
                ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                     <p style={{ color: '#2ecc71', fontSize: '1.1rem', marginBottom: '10px', fontWeight: 'bold' }}>🎯 正確配對</p>
                     {(reviewData?.question?.topItems || []).map((top: any, idx: number) => {
                       const correctBottomId = reviewData?.question?.correctMatches?.[top.id];
                       const bottomItem = reviewData?.question?.bottomItems?.find((b: any) => b.id === correctBottomId);
                       return (
                         <div key={top.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(46, 204, 113, 0.1)', padding: '10px', borderRadius: '10px', border: '1px solid #2ecc71' }}>
                            <div style={{ textAlign: 'center', width: '80px' }}><img src={top.img} alt="top" referrerPolicy="no-referrer" style={{ width: '100%', height: '60px', objectFit: 'contain', background: '#000', borderRadius: '5px' }} /><p style={{ fontSize: '0.8rem', marginTop: '5px', color: '#fff' }}>{top.name}</p></div>
                            <span style={{ fontSize: '1.5rem' }}>🔗</span>
                            <div style={{ textAlign: 'center', width: '80px' }}><img src={bottomItem?.img} alt="bottom" referrerPolicy="no-referrer" style={{ width: '100%', height: '60px', objectFit: 'contain', background: '#000', borderRadius: '5px' }} /></div>
                         </div>
                       );
                     })}
                   </div>
                )}
                {reviewData.hasNextQuestion ? 
                  <button className="btn-summon" onClick={() => socket.emit('host_send_question', hostingPin)} style={{ background: '#2ecc71', marginTop: '15px' }}>▶️ 下一題</button> : 
                  <button className="btn-summon" onClick={() => socket.emit('host_show_podium', hostingPin)} style={{ background: '#f1c40f', marginTop: '15px' }}>🏆 揭曉最終榮耀</button>
                }
              </div>
            )}

            {podiumData && (
              <div style={{ animation: 'bounceIn 1s ease' }}>
                <div className="firework fw-1">🎆</div><div className="firework fw-2">🎇</div><div className="firework fw-3">✨</div><div className="firework fw-4">🎊</div>
                <div className="podium-content">
                  <h2 style={{ color: '#FFD700', fontSize: '2.5rem', marginBottom: '2rem', textShadow: '0 0 15px rgba(255,215,0,0.8)' }}>🏆 傳奇誕生 🏆</h2>
                  {podiumData?.[0] && <h3 style={{color: '#f1c40f', fontSize: '2.2rem', margin: '20px 0'}}>🥇 {podiumData[0]?.username} <span style={{fontSize:'1.2rem'}}>({podiumData[0]?.score}分)</span></h3>}
                  {podiumData?.[1] && <h4 style={{color: '#bdc3c7', fontSize: '1.7rem', margin: '20px 0'}}>🥈 {podiumData[1]?.username} <span style={{fontSize:'1rem'}}>({podiumData[1]?.score}分)</span></h4>}
                  {podiumData?.[2] && <h4 style={{color: '#e67e22', fontSize: '1.4rem', margin: '20px 0'}}>🥉 {podiumData[2]?.username} <span style={{fontSize:'0.9rem'}}>({podiumData[2]?.score}分)</span></h4>}
                </div>
                {/* 👇 返回控制台按鈕 👇 */}
                <button className="btn-summon" onClick={handleReturnToDashboard} style={{ background: '#3498db', marginTop: '30px' }}>🏠 返回控制台</button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (editingPack) {
    return (
      <div className="game-panel" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ color: '#FFD700' }}>✏️ 題庫包編輯器</h2>
          <button onClick={() => setEditingPack(null)} style={{ padding: '0.5rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '5px' }}>放棄並返回</button>
        </div>

        <input type="text" value={editingPack.title} onChange={(e) => setEditingPack({...editingPack, title: e.target.value})} placeholder="請輸入題庫包名稱 (如: 週末公會大賽)" className="game-input" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#f1c40f' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
          {editingPack.questions.length === 0 ? <p style={{color: '#888'}}>目前沒有題目，請在下方新增！</p> : 
           editingPack.questions.map((q: any, idx: number) => (
            <div key={q.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ background: q.type==='choice'?'#3498db':'#9b59b6', padding: '3px 8px', borderRadius: '5px', fontSize: '0.8rem', marginRight: '10px' }}>{q.type==='choice'?'單選':'配對'}</span>
                <strong>Q{idx + 1}. {q.text}</strong>
              </div>
              <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '5px' }}>刪除</button>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '10px', marginTop: '2rem', border: '1px dashed #7f8c8d' }}>
          <h3 style={{ color: '#2ecc71', marginBottom: '15px' }}>➕ 新增一題</h3>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <select value={qType} onChange={(e) => setQType(e.target.value as any)} className="game-input" style={{ flex: 1 }}>
              <option value="choice">單選題</option>
              <option value="match">圖片配對題</option>
            </select>
            <input type="number" placeholder="秒數" value={newTime} onChange={(e) => setNewTime(Number(e.target.value))} className="game-input" style={{ width: '80px' }} title="作答時間(秒)" />
          </div>
          
          <input type="text" placeholder="請輸入題目敘述文字" value={newQText} onChange={(e) => setNewQText(e.target.value)} className="game-input" />

          {qType === 'choice' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                <input type="text" placeholder="選項 A (必填)" value={newOptA} onChange={(e) => setNewOptA(e.target.value)} className="game-input" style={{ marginBottom: 0 }} />
                <input type="text" placeholder="選項 B (必填)" value={newOptB} onChange={(e) => setNewOptB(e.target.value)} className="game-input" style={{ marginBottom: 0 }} />
                <input type="text" placeholder="選項 C (選填)" value={newOptC} onChange={(e) => setNewOptC(e.target.value)} className="game-input" style={{ marginBottom: 0 }} />
                <input type="text" placeholder="選項 D (選填)" value={newOptD} onChange={(e) => setNewOptD(e.target.value)} className="game-input" style={{ marginBottom: 0 }} />
              </div>
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#fff' }}>正確解答:</span>
                <select value={newAns} onChange={(e) => setNewAns(e.target.value)} className="game-input" style={{ width: '100px', marginBottom: 0 }}>
                  <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                </select>
              </div>
            </>
          )}

          {/* 👇 圖片配對題專屬 UI：使用檔案上傳取代文字框 👇 */}
          {qType === 'match' && (
            <div style={{ textAlign: 'left', marginTop: '10px' }}>
              <p style={{ color: '#f1c40f', fontSize: '0.85rem', marginBottom: '10px' }}>
                * 請依照正確配對組合上傳。建議尺寸 1:1 (如 300x300 px)，支援 JPG/PNG，單張大小限 <strong>300KB</strong> 內。
              </p>
              {matchPairs.map((pair, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '5px' }}>
                  <span style={{ color: '#fff', width: '20px' }}>{index+1}.</span>
                  <input type="text" placeholder="魔靈名字" value={pair.tName} onChange={e => updateMatchPair(index, 'tName', e.target.value)} className="game-input" style={{ padding: '5px', marginBottom: 0, flex: 1 }} />
                  
                  {/* 魔靈圖上傳按鈕 */}
                  <label style={{ flex: 1, height: '40px', background: 'rgba(0,0,0,0.3)', border: '1px dashed #3498db', borderRadius: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                    {pair.tImg ? <img src={pair.tImg} alt="預覽" style={{ height: '100%', objectFit: 'contain' }} /> : <span style={{fontSize: '0.8rem', color: '#3498db'}}>+ 選擇圖片</span>}
                    <input type="file" accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={(e) => handleImageUpload(index, 'tImg', e)} />
                  </label>

                  <span style={{ color: '#2ecc71', margin: '0 2px' }}>🔗</span>

                  {/* 目標圖上傳按鈕 */}
                  <label style={{ flex: 1, height: '40px', background: 'rgba(0,0,0,0.3)', border: '1px dashed #e74c3c', borderRadius: '5px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                    {pair.bImg ? <img src={pair.bImg} alt="預覽" style={{ height: '100%', objectFit: 'contain' }} /> : <span style={{fontSize: '0.8rem', color: '#e74c3c'}}>+ 選擇圖片</span>}
                    <input type="file" accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={(e) => handleImageUpload(index, 'bImg', e)} />
                  </label>
                </div>
              ))}
            </div>
          )}

          <button className="btn-summon" onClick={handleAddQuestion} style={{ marginTop: '15px', background: '#3498db', fontSize: '1rem', padding: '10px' }}>加入這題至題庫包</button>
        </div>

        <button className="btn-summon" onClick={handleSavePack} style={{ marginTop: '20px', background: '#2ecc71' }}>💾 儲存並發布題庫包</button>
      </div>
    );
  }

  return (
    <div className="game-panel" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2 style={{ color: '#FFD700' }}>📚 創作者儀表板 ({adminUser})</h2>
        <button onClick={() => setAdminUser(null)} style={{ padding: '0.5rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '5px' }}>登出</button>
      </div>
      
      <button className="btn-summon" onClick={handleCreateNewPack} style={{ background: '#2ecc71', marginBottom: '20px' }}>➕ 建立全新的題庫包</button>

      <div style={{ display: 'grid', gap: '15px' }}>
        {quizPacks.map(pack => (
          <div key={pack._id} style={{ background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ color: '#fff' }}>{pack.title}</h3>
              <p style={{ color: '#bdc3c7', fontSize: '0.9rem' }}>共 {pack.questions.length} 題</p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-summon" onClick={() => setEditingPack(pack)} style={{ width: 'auto', padding: '10px 15px', background: '#3498db', fontSize: '1rem' }}>編輯</button>
              <button className="btn-summon" onClick={() => handleDeletePack(pack._id)} style={{ width: 'auto', padding: '10px 15px', background: '#e74c3c', fontSize: '1rem' }}>🗑️ 刪除</button>
              <button className="btn-summon" onClick={() => handleHostGame(pack._id)} style={{ width: 'auto', padding: '10px 15px', background: '#e67e22', fontSize: '1rem' }}>🚀 開房</button>
            </div>
          </div>
        ))}
        {quizPacks.length === 0 && <p style={{ color: '#888' }}>目前沒有任何題庫包，點擊上方按鈕建立一個吧！</p>}
      </div>
    </div>
  );
}

// ==========================================
// 🔀 路由中心 (App Router)
// ==========================================
export default function App() {
  return (
    <ErrorBoundary>
      <div style={{ 
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', 
        justifyContent: 'flex-start', alignItems: 'center', paddingTop: '8vh', fontFamily: '"Noto Sans TC", sans-serif',
        background: `radial-gradient(circle at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.95) 90%), url("https://event-fn.qpyou.cn/event/brand/smon_v2/event/12th_anniversary/assets/summonerswar_12anniv_2.jpg")`,
        backgroundSize: 'cover', backgroundPosition: 'center', overflowY: 'auto'
      }}>
        <div style={{ textAlign: 'center', zIndex: 10, marginBottom: '20px' }}><h1 className="text-glow">傳奇金頭腦挑戰賽</h1></div>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PlayerApp />} />
            <Route path="/admin" element={<AdminApp />} />
          </Routes>
        </BrowserRouter>
      </div>
    </ErrorBoundary>
  );
}