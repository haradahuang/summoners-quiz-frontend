import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './index.css';

const API_URL = 'https://swtest-pgq8.onrender.com/api';
const socket: Socket = io('https://swtest-pgq8.onrender.com');

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
    socket.on('update_players', (list) => setPlayers(list || []));
    socket.on('receive_question', (q) => { setCurrentQuestion(q); setTimeLeft(q?.timeLimit || 15); setHasAnswered(false); setAnswerResult(null); setLeaderboard(null); setReviewData(null); setPodiumData(null); setUserMatches({}); setActiveTopId(null); });
    socket.on('answer_result', setAnswerResult);
    socket.on('leaderboard_updated', setLeaderboard);
    socket.on('review_updated', setReviewData);
    socket.on('podium_updated', (top3) => { setPodiumData(top3); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });
    socket.on('join_error', (msg) => { alert(msg); setIsJoined(false); });
    return () => { socket.off(); };
  }, []);

  useEffect(() => {
    if (currentQuestion && timeLeft > 0 && !hasAnswered && !leaderboard && !reviewData && !podiumData) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000); return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && currentQuestion && !hasAnswered) {
      setHasAnswered(true); socket.emit('submit_answer', { pin, answerData: currentQuestion?.type === 'match' ? userMatches : '' });
    }
  }, [currentQuestion, timeLeft, hasAnswered, leaderboard, reviewData, podiumData]);

  const handleJoinArena = () => { if (username.trim() && pin.trim()) { socket.emit('join_room', { pin, username }); setIsJoined(true); } };
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

      {isJoined && leaderboard && (
         <div className="game-panel">
         <h2 style={{ color: '#FFD700', fontSize: '2rem', marginBottom: '1.5rem' }}>🏆 排名結算</h2>
         {(leaderboard || []).map((player: any, idx: number) => (
           <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem', borderRadius: '8px', borderLeft: idx === 0 ? '5px solid #FFD700' : '5px solid #444', fontSize: '1.1rem' }}>
             <span style={{ color: '#FFF' }}>#{idx + 1} {player?.username}</span><span style={{ color: '#FFD700', fontWeight: 'bold' }}>{player?.score} 分</span>
           </div>
         ))}
       </div>
      )}

      {isJoined && reviewData && (
        <div className="game-panel">
          <h2 style={{ color: '#3498db', fontSize: '1.8rem', marginBottom: '1rem' }}>數據復盤</h2>
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
               <p style={{ color: '#2ecc71', fontSize: '1.1rem', marginBottom: '10px', fontWeight: 'bold' }}>🎯 正確配對解答</p>
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
        <div className="game-panel">
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
// 👑 管理端介面 (Admin View)
// ==========================================
function AdminApp() {
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [quizPacks, setQuizPacks] = useState<any[]>([]);
  const [hostingPin, setHostingPin] = useState<string | null>(null);
  const [hostingUrl, setHostingUrl] = useState<string | null>(null);
  
  // 控場狀態
  const [players, setPlayers] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [podiumData, setPodiumData] = useState<any[] | null>(null);

  useEffect(() => {
    socket.on('room_created', ({ pin, joinUrl }) => { setHostingPin(pin); setHostingUrl(window.location.origin + joinUrl); });
    socket.on('update_players', (list) => setPlayers(list || []));
    socket.on('receive_question', (q) => { setCurrentQuestion(q); setLeaderboard(null); setReviewData(null); setPodiumData(null); });
    socket.on('leaderboard_updated', setLeaderboard);
    socket.on('review_updated', setReviewData);
    socket.on('podium_updated', (top3) => { setPodiumData(top3); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });
    return () => { socket.off(); };
  }, []);

  const fetchQuizzes = async (user: string) => {
    try {
      const res = await fetch(`${API_URL}/quizzes/${user}`);
      const data = await res.json();
      setQuizPacks(data);
    } catch (e) { console.error('讀取題庫失敗'); }
  };

  const handleAuth = async () => {
    if(!username || !password) return alert('請填寫帳號密碼');
    const endpoint = authMode === 'login' ? '/login' : '/register';
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok) {
        if(authMode === 'login') { setAdminUser(data.username); fetchQuizzes(data.username); }
        else { alert('註冊成功，請登入！'); setAuthMode('login'); }
      } else alert(data.error);
    } catch (e) { alert('伺服器連線失敗'); }
  };

  const handleCreateDummyPack = async () => {
    // 建立一個預設題庫包來測試
    const dummyData = {
      title: "我的第一個魔靈題庫", author: adminUser,
      questions: [
        { id: 1, type: 'choice', text: "風屬性小丑的覺醒名稱是？", correctAnswer: 'A', options: [ { id: 'A', text: "盧森", color: '#e53e3e' }, { id: 'B', text: "朱力", color: '#3182ce' } ], timeLimit: 15 }
      ]
    };
    await fetch(`${API_URL}/quizzes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dummyData) });
    fetchQuizzes(adminUser!);
  };

  const handleHostGame = (packId: string) => { socket.emit('host_create_room', packId); };

  if (!adminUser) {
    return (
      <div className="game-panel" style={{ maxWidth: '400px', margin: '0 auto' }}>
        <h2 style={{ color: '#FFD700', marginBottom: '1rem' }}>🔧 {authMode === 'login' ? '登入創作者後台' : '註冊新帳號'}</h2>
        <input type="text" placeholder="帳號" value={username} onChange={(e) => setUsername(e.target.value)} className="game-input" />
        <input type="password" placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} className="game-input" />
        <button className="btn-summon" onClick={handleAuth}>{authMode === 'login' ? '登入' : '註冊'}</button>
        <p style={{ marginTop: '10px', cursor: 'pointer', color: '#3498db' }} onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}>
          {authMode === 'login' ? '沒有帳號？點此註冊' : '已有帳號？點此登入'}
        </p>
      </div>
    );
  }

  if (hostingPin) {
    // 控場模式
    return (
      <div className="game-panel" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ color: '#e74c3c' }}>👑 主持人控場中心</h2>
        <h3 style={{ color: '#f1c40f', fontSize: '2rem' }}>房號: {hostingPin}</h3>
        <p style={{ color: '#2ecc71', margin: '10px 0', wordBreak: 'break-all' }}>玩家加入連結: <br/><a href={hostingUrl!} target="_blank" rel="noreferrer" style={{color: '#3498db'}}>{hostingUrl}</a></p>
        <p>目前進場: {players.length} 人</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center', margin: '10px 0' }}>
          {(players || []).map((p, i) => <span key={i} style={{ background: 'rgba(255,215,0,0.1)', padding: '3px 8px', borderRadius: '5px', fontSize: '0.8rem', color: '#FFD700' }}>{p.username} ({p.score})</span>)}
        </div>

        <hr style={{ borderColor: '#444', margin: '20px 0' }}/>

        {!currentQuestion && !leaderboard && !reviewData && !podiumData && <button className="btn-summon" onClick={() => socket.emit('host_send_question', hostingPin)}>▶️ 發送題目</button>}
        
        {currentQuestion && !leaderboard && !reviewData && !podiumData && (
          <div>
            <h3 style={{ color: '#fff' }}>題目作答中...</h3>
            <button className="btn-summon" onClick={() => socket.emit('host_show_leaderboard', hostingPin)} style={{ background: '#9b59b6', marginTop: '15px' }}>📊 結算當前排名</button>
          </div>
        )}

        {leaderboard && <button className="btn-summon" onClick={() => socket.emit('host_show_review', hostingPin)} style={{ background: '#34495e', marginTop: '15px' }}>🔍 檢視戰報</button>}
        
        {reviewData && reviewData.hasNextQuestion && <button className="btn-summon" onClick={() => socket.emit('host_send_question', hostingPin)} style={{ background: '#2ecc71', marginTop: '15px' }}>▶️ 下一題</button>}
        {reviewData && !reviewData.hasNextQuestion && <button className="btn-summon" onClick={() => socket.emit('host_show_podium', hostingPin)} style={{ background: '#f1c40f', marginTop: '15px' }}>🏆 揭曉最終榮耀</button>}
      </div>
    );
  }

  // 儀表板模式
  return (
    <div className="game-panel" style={{ width: '100%', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h2 style={{ color: '#FFD700' }}>📚 歡迎, {adminUser}</h2>
        <button onClick={() => setAdminUser(null)} style={{ padding: '0.5rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '5px' }}>登出</button>
      </div>
      
      <button className="btn-summon" onClick={handleCreateDummyPack} style={{ background: '#2ecc71', marginBottom: '20px' }}>➕ 新增題庫包 (測試用)</button>

      <div style={{ display: 'grid', gap: '15px' }}>
        {quizPacks.map(pack => (
          <div key={pack._id} style={{ background: 'rgba(255,255,255,0.1)', padding: '15px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ color: '#fff' }}>{pack.title}</h3>
              <p style={{ color: '#bdc3c7', fontSize: '0.9rem' }}>共 {pack.questions.length} 題</p>
            </div>
            <button className="btn-summon" onClick={() => handleHostGame(pack._id)} style={{ width: 'auto', padding: '10px 20px', background: '#e67e22' }}>🚀 開房</button>
          </div>
        ))}
        {quizPacks.length === 0 && <p>目前沒有題庫，點擊上方按鈕建立一個吧！</p>}
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