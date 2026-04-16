import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './index.css';

const socket: Socket = io('https://swtest-pgq8.onrender.com'); 

class ErrorBoundary extends React.Component<any, { hasError: boolean, errorMsg: string }> {
  constructor(props: any) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, errorMsg: error.toString() }; }
  render() {
    if (this.state.hasError) return (<div style={{ padding: '2rem', color: '#e74c3c' }}><h2>❌ 致命錯誤</h2><p>{this.state.errorMsg}</p></div>);
    return this.props.children;
  }
}

export default function App() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  
  // 玩家名單現在包含分數： { username: string, score: number }
  const [players, setPlayers] = useState<any[]>([]);
  
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [podiumData, setPodiumData] = useState<any[] | null>(null);

  const [viewMode, setViewMode] = useState<'home' | 'adminAuth' | 'adminPanel'>('home');
  const [adminPwd, setAdminPwd] = useState('');
  const [qBank, setQBank] = useState<any[]>([]);
  const [qType, setQType] = useState<'choice' | 'match'>('choice');
  const [newQText, setNewQText] = useState('');
  const [newOptA, setNewOptA] = useState(''); const [newOptB, setNewOptB] = useState('');
  const [newOptC, setNewOptC] = useState(''); const [newOptD, setNewOptD] = useState('');
  const [newAns, setNewAns] = useState('B');
  const [newTime, setNewTime] = useState(15);

  const [activeTopId, setActiveTopId] = useState<string | null>(null);
  const [userMatches, setUserMatches] = useState<Record<string, string>>({});

  useEffect(() => {
    socket.on('update_players', (list) => setPlayers(list || []));
    
    socket.on('receive_question', (q) => { 
      setCurrentQuestion(q); setTimeLeft(q?.timeLimit || 15); setHasAnswered(false); 
      setAnswerResult(null); setLeaderboard(null); setReviewData(null); setPodiumData(null); 
      setUserMatches({}); setActiveTopId(null); 
    });
    socket.on('answer_result', setAnswerResult);
    socket.on('leaderboard_updated', setLeaderboard);
    socket.on('review_updated', setReviewData);
    socket.on('podium_updated', (top3) => { setPodiumData(top3); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });
    socket.on('admin_auth_success', (bank) => { setQBank(bank || []); setViewMode('adminPanel'); });
    socket.on('admin_auth_fail', () => alert('❌ 密碼錯誤！'));
    socket.on('admin_update_bank', (bank) => setQBank(bank || []));

    return () => { socket.off(); };
  }, []);

  useEffect(() => {
    if (currentQuestion && timeLeft > 0 && !hasAnswered && !leaderboard && !reviewData && !podiumData) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && currentQuestion && !hasAnswered && !isHost) {
      setHasAnswered(true);
      socket.emit('submit_answer', { pin, answerData: currentQuestion?.type === 'match' ? userMatches : '' });
    }
  }, [currentQuestion, timeLeft, hasAnswered, isHost, leaderboard, reviewData, podiumData]);

  const handleJoinArena = () => { if (username.trim() && pin.trim()) { socket.emit('join_room', { pin, username, isHost }); setIsJoined(true); } };
  const handleSendQuestion = () => socket.emit('host_send_question', pin);
  const handleChoiceClick = (answerId: string) => { if (!hasAnswered && !isHost) { setHasAnswered(true); socket.emit('submit_answer', { pin, answerData: answerId }); } };
  const handleMatchSubmit = () => { if (!hasAnswered && !isHost) { setHasAnswered(true); socket.emit('submit_answer', { pin, answerData: userMatches }); } };

  const handleTopClick = (id: string) => {
    if (isHost) return;
    setActiveTopId(id === activeTopId ? null : id);
    setUserMatches(prev => { const newMatches = { ...prev }; if (newMatches[id]) delete newMatches[id]; return newMatches; });
  };

  const handleBottomClick = (bottomId: string) => {
    if (isHost) return;
    setUserMatches(prev => {
      const newMatches = { ...prev };
      let existingTopKey = null;
      for (const key in newMatches) { if (newMatches[key] === bottomId) existingTopKey = key; }
      if (activeTopId) {
        if (existingTopKey) delete newMatches[existingTopKey];
        newMatches[activeTopId] = bottomId; setActiveTopId(null);
      } else {
        if (existingTopKey) delete newMatches[existingTopKey];
      }
      return newMatches;
    });
  };

  const handleShowLeaderboard = () => socket.emit('host_show_leaderboard', pin);
  const handleShowReview = () => socket.emit('host_show_review', pin);
  const handleShowPodium = () => socket.emit('host_show_podium', pin);
  const handleAdminLogin = () => socket.emit('admin_login', adminPwd);
  const handleAddQuestion = () => {
    if(!newQText) return alert('請填寫題目！');
    const qData = {
      type: qType, text: newQText, timeLimit: newTime,
      ...(qType === 'choice' ? {
        correctAnswer: newAns, options: [ { id: 'A', text: newOptA || 'A', color: '#e53e3e' }, { id: 'B', text: newOptB || 'B', color: '#3182ce' }, { id: 'C', text: newOptC || 'C', color: '#d69e2e' }, { id: 'D', text: newOptD || 'D', color: '#805ad5' } ]
      } : {
        topItems: [{id: 'T1', name:'魔靈 A'}, {id: 'T2', name:'魔靈 B'}, {id: 'T3', name:'魔靈 C'}, {id: 'T4', name:'魔靈 D'}], bottomItems: [{id: 'B1'}, {id: 'B2'}, {id: 'B3'}, {id: 'B4'}], correctMatches: { 'T1':'B1', 'T2':'B2', 'T3':'B3', 'T4':'B4' }
      })
    };
    socket.emit('admin_add_q', qData); setNewQText('');
  };

  const topColors: Record<string, string> = { 'T1': '#e74c3c', 'T2': '#3498db', 'T3': '#f1c40f', 'T4': '#9b59b6' };

  // 👇 計算當前玩家自己的名次與分數 👇
  const sortedPlayers = [...(players || [])].sort((a, b) => b.score - a.score);
  const myRankIndex = sortedPlayers.findIndex(p => p.username === username);
  const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '-';
  const myScore = players.find(p => p.username === username)?.score || 0;

  return (
    <ErrorBoundary>
      <div style={{ 
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', 
        justifyContent: 'flex-start', alignItems: 'center', paddingTop: '8vh', fontFamily: '"Noto Sans TC", sans-serif',
        background: `radial-gradient(circle at center, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.95) 90%), url("https://event-fn.qpyou.cn/event/brand/smon_v2/event/12th_anniversary/assets/summonerswar_12anniv_2.jpg")`,
        backgroundSize: 'cover', backgroundPosition: 'center', overflowY: 'auto'
      }}>
        
        {!isJoined && viewMode === 'home' && <button onClick={() => setViewMode('adminAuth')} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', opacity: 0.3 }}>⚙️</button>}
        {viewMode === 'home' && <div style={{ textAlign: 'center', zIndex: 10 }}><h1 className="text-glow">傳奇金頭腦挑戰賽</h1></div>}

        <div style={{ padding: '0 10px', width: '100%', display: 'flex', justifyContent: 'center', zIndex: 10, paddingBottom: '30px' }}>
          
          {viewMode === 'home' && !isJoined && (
            <div className="game-panel" style={{ maxWidth: '400px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#FFD700', cursor: 'pointer', fontWeight: 'bold', marginBottom: '1rem' }}>
                <input type="checkbox" checked={isHost} onChange={(e) => setIsHost(e.target.checked)} style={{ width: '1.2rem', height: '1.2rem' }} /> 👑 主持人模式
              </label>
              <input type="text" placeholder="房間代碼" value={pin} onChange={(e) => setPin(e.target.value)} className="game-input" />
              <input type="text" placeholder="您的暱稱" value={username} onChange={(e) => setUsername(e.target.value)} className="game-input" />
              <button className="btn-summon" onClick={handleJoinArena}>進入競技場</button>
            </div>
          )}

          {viewMode === 'home' && isJoined && !currentQuestion && !leaderboard && !reviewData && !podiumData && (
            <div className="game-panel" style={{ maxWidth: '400px' }}>
              <h2 style={{ color: '#FFD700', fontSize: '1.8rem', marginBottom: '1rem' }}>房號: {pin}</h2>
              {isHost ? <button className="btn-summon" onClick={handleSendQuestion}>▶️ 開始試煉</button> : <p style={{ fontSize: '1.3rem', color: '#3498db' }}>等待大師開啟試煉...</p>}
              <p style={{ color: '#bdc3c7', marginTop: '1rem' }}>已進場: {(players || []).length} 人</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', justifyContent: 'center', marginTop: '10px' }}>
                {(players || []).map((p, i) => <span key={i} style={{ background: 'rgba(255,215,0,0.1)', padding: '3px 8px', borderRadius: '5px', fontSize: '0.8rem', color: '#FFD700' }}>{p.username}</span>)}
              </div>
            </div>
          )}

          {/* 答題畫面 */}
          {viewMode === 'home' && isJoined && currentQuestion && !leaderboard && !reviewData && !podiumData && (
            <div className="game-panel question-transition" key={currentQuestion.id}>
              
              {/* 👇 玩家個人的頂部積分列 👇 */}
              {!isHost && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1c40f', fontWeight: 'bold', fontSize: '0.95rem', marginBottom: '15px', borderBottom: '1px solid rgba(255,215,0,0.3)', paddingBottom: '8px' }}>
                  <span>👤 {username}</span>
                  <span>🏆 積分: {myScore} | 🏅 排名: {myRank}</span>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <p style={{ color: '#bdc3c7', fontSize: '0.85rem', marginBottom: '5px', fontWeight: 'bold' }}>戰局進度: {currentQuestion?.currentQIndex || 1} / {currentQuestion?.totalQuestions || 1}</p>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                  <div style={{ height: '100%', background: '#FFD700', width: `${((currentQuestion?.currentQIndex || 1) / (currentQuestion?.totalQuestions || 1)) * 100}%`, transition: 'width 0.5s', borderRadius: '3px' }} />
                </div>
              </div>

              <h2 style={{ color: '#FFF', fontSize: '1.3rem', marginBottom: '1rem', textShadow: '0 2px 5px rgba(0,0,0,1)' }}>{currentQuestion?.text}</h2>
              <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
                <div style={{ height: '100%', background: timeLeft <= 5 ? '#e74c3c' : '#2ecc71', width: `${(timeLeft / (currentQuestion?.timeLimit || 15)) * 100}%`, transition: 'width 1s linear' }} />
              </div>

              <div style={{ pointerEvents: isHost ? 'none' : 'auto', opacity: isHost ? 0.7 : 1 }}>
                {currentQuestion?.type === 'choice' && !hasAnswered && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {(currentQuestion?.options || []).map((opt: any, index: number) => (
                      <button key={opt?.id || index} onClick={() => handleChoiceClick(opt?.id)} style={{ padding: '1rem', fontSize: '1.1rem', color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', border: 'none', borderLeft: `6px solid ${opt?.color || '#fff'}`, cursor: 'pointer' }}>{opt?.text}</button>
                    ))}
                  </div>
                )}

                {currentQuestion?.type === 'match' && !hasAnswered && (
                  <div>
                    {!isHost && <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '10px' }}>💡 點擊上方魔靈，再點下方圖片來配對</p>}
                    <div className="match-grid">
                      {(currentQuestion?.topItems || []).map((item: any, index: number) => {
                        const isActive = activeTopId === item?.id; const isMatched = Boolean(userMatches?.[item?.id]); const itemColor = topColors[item?.id] || '#fff';
                        return (
                          <div key={item?.id || index} onClick={() => handleTopClick(item?.id)} className={`match-item ${isActive ? 'active' : ''}`} style={{ borderColor: isActive || isMatched ? itemColor : 'transparent' }}>
                            {item?.img && <img src={item.img} alt="top" referrerPolicy="no-referrer" crossOrigin="anonymous" />}
                            <p>{item?.name || `目標 ${index+1}`}</p>
                            {isMatched && <div className="match-badge" style={{ background: itemColor }}>✓</div>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="match-grid">
                      {(currentQuestion?.bottomItems || []).map((item: any, index: number) => {
                        let matchedTopId: string | null = null;
                        if (userMatches) { for (const k in userMatches) { if (userMatches[k] === item?.id) matchedTopId = k; } }
                        return (
                          <div key={item?.id || index} onClick={() => handleBottomClick(item?.id)} className="match-item" style={{ borderColor: matchedTopId ? topColors[matchedTopId] : 'transparent' }}>
                            {item?.img && <img src={item.img} alt="bottom" referrerPolicy="no-referrer" crossOrigin="anonymous" />}
                            {matchedTopId && <div className="match-badge" style={{ background: topColors[matchedTopId] || '#fff' }}>✓</div>}
                          </div>
                        );
                      })}
                    </div>
                    {!isHost && (
                      <button className="btn-summon" onClick={handleMatchSubmit} disabled={Object.keys(userMatches || {}).length !== (currentQuestion?.topItems?.length || 4)} style={{ marginTop: '10px' }}>
                        {Object.keys(userMatches || {}).length === (currentQuestion?.topItems?.length || 4) ? '確認送出配對！' : '請完成所有配對...'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {isHost && <button className="btn-summon" onClick={handleShowLeaderboard} style={{ background: '#9b59b6', marginTop: '1.5rem' }}>📊 結算當前排名</button>}
              
              {answerResult && !isHost && (
                <div style={{ animation: 'bounceIn 0.8s ease', marginTop: '1rem' }}>
                  <h3 style={{ fontSize: '2rem', color: answerResult?.isCorrect ? '#2ecc71' : '#e74c3c' }}>{answerResult?.isCorrect ? `✨ 答對了！ +${answerResult?.earnedScore}` : '💀 殘念...'}</h3>
                </div>
              )}
            </div>
          )}

          {viewMode === 'home' && isJoined && leaderboard && (
             <div className="game-panel">
             <h2 style={{ color: '#FFD700', fontSize: '2rem', marginBottom: '1.5rem' }}>🏆 排名結算</h2>
             {(leaderboard || []).map((player: any, index: number) => (
               <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem', borderRadius: '8px', borderLeft: index === 0 ? '5px solid #FFD700' : '5px solid #444', fontSize: '1.1rem' }}>
                 <span style={{ color: '#FFF' }}>#{index + 1} {player?.username}</span>
                 <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{player?.score} 分</span>
               </div>
             ))}
             {isHost && <button className="btn-summon" onClick={handleShowReview} style={{ marginTop: '1.5rem', background: '#34495e' }}>🔍 檢視戰報</button>}
           </div>
          )}

          {viewMode === 'home' && isJoined && reviewData && (
            <div className="game-panel">
              <h2 style={{ color: '#3498db', fontSize: '1.8rem', marginBottom: '1rem' }}>數據復盤</h2>
              
              {reviewData?.question?.type === 'choice' ? (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                   {(reviewData?.question?.options || []).map((opt: any, index: number) => {
                     const isCorrect = opt?.id === reviewData?.question?.correctAnswer;
                     return (
                       <div key={opt?.id || index} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: isCorrect ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.05)', border: isCorrect ? '2px solid #2ecc71' : '1px solid #444', borderRadius: '8px' }}>
                         <span style={{ color: isCorrect ? '#2ecc71' : '#fff' }}>{isCorrect && '✔️ '} {opt?.text}</span>
                         <span style={{ color: '#bdc3c7' }}>{reviewData?.stats?.[opt?.id] || 0} 人</span>
                       </div>
                     );
                   })}
                 </div>
              ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                   <p style={{ color: '#2ecc71', fontSize: '1.1rem', marginBottom: '10px', fontWeight: 'bold' }}>🎯 正確配對解答</p>
                   {(reviewData?.question?.topItems || []).map((top: any, index: number) => {
                     const correctBottomId = reviewData?.question?.correctMatches?.[top.id];
                     const bottomItem = reviewData?.question?.bottomItems?.find((b: any) => b.id === correctBottomId);
                     return (
                       <div key={top.id || index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(46, 204, 113, 0.1)', padding: '10px', borderRadius: '10px', border: '1px solid #2ecc71' }}>
                          <div style={{ textAlign: 'center', width: '80px' }}>
                            <img src={top.img} alt="top" referrerPolicy="no-referrer" style={{ width: '100%', height: '60px', objectFit: 'contain', background: '#000', borderRadius: '5px' }} />
                            <p style={{ fontSize: '0.8rem', marginTop: '5px', color: '#fff' }}>{top.name}</p>
                          </div>
                          <span style={{ fontSize: '1.5rem' }}>🔗</span>
                          <div style={{ textAlign: 'center', width: '80px' }}>
                            <img src={bottomItem?.img} alt="bottom" referrerPolicy="no-referrer" style={{ width: '100%', height: '60px', objectFit: 'contain', background: '#000', borderRadius: '5px' }} />
                          </div>
                       </div>
                     );
                   })}
                 </div>
              )}
              
              {isHost && reviewData?.hasNextQuestion && <button className="btn-summon" onClick={handleSendQuestion} style={{ marginTop: '1.5rem', background: '#2ecc71' }}>▶️ 下一題</button>}
              {isHost && !reviewData?.hasNextQuestion && <button className="btn-summon" onClick={handleShowPodium} style={{ marginTop: '1.5rem', background: '#f1c40f' }}>🏆 揭曉最終榮耀</button>}
            </div>
          )}

          {/* 👇 最終頒獎台：煙火改在兩側邊緣、加入分數後綴 👇 */}
          {viewMode === 'home' && isJoined && podiumData && (
            <div className="game-panel">
              <div className="firework fw-1">🎆</div>
              <div className="firework fw-2">🎇</div>
              <div className="firework fw-3">✨</div>
              <div className="firework fw-4">🎊</div>
              
              <div className="podium-content">
                <h2 style={{ color: '#FFD700', fontSize: '2.5rem', marginBottom: '2rem', textShadow: '0 0 15px rgba(255,215,0,0.8)' }}>🏆 傳奇誕生 🏆</h2>
                {podiumData?.[0] && <h3 style={{color: '#f1c40f', fontSize: '2.2rem', margin: '20px 0'}}>🥇 {podiumData[0]?.username} <span style={{fontSize:'1.2rem'}}>({podiumData[0]?.score}分)</span></h3>}
                {podiumData?.[1] && <h4 style={{color: '#bdc3c7', fontSize: '1.7rem', margin: '20px 0'}}>🥈 {podiumData[1]?.username} <span style={{fontSize:'1rem'}}>({podiumData[1]?.score}分)</span></h4>}
                {podiumData?.[2] && <h4 style={{color: '#e67e22', fontSize: '1.4rem', margin: '20px 0'}}>🥉 {podiumData[2]?.username} <span style={{fontSize:'0.9rem'}}>({podiumData[2]?.score}分)</span></h4>}
              </div>
            </div>
          )}

          {/* 後台介面維持不變 */}
          {viewMode === 'adminAuth' && (
            <div className="game-panel" style={{ maxWidth: '400px' }}>
              <h2 style={{ color: '#FFD700', marginBottom: '1rem' }}>🔧 進入題庫管理</h2>
              <input type="password" placeholder="管理員密碼" value={adminPwd} onChange={(e) => setAdminPwd(e.target.value)} className="game-input" />
              <button className="btn-summon" onClick={handleAdminLogin} style={{ marginBottom: '1rem' }}>登入</button>
              <button onClick={() => setViewMode('home')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>返回</button>
            </div>
          )}
          {viewMode === 'adminPanel' && (
            <div className="game-panel" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h2 style={{ color: '#FFD700' }}>📚 題庫管理中心</h2>
                <button onClick={() => setViewMode('home')} style={{ padding: '0.5rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '5px' }}>登出</button>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '10px', marginBottom: '2rem' }}>
                <select value={qType} onChange={(e) => setQType(e.target.value as any)} className="game-input">
                  <option value="choice">單選題</option>
                  <option value="match">圖片配對題</option>
                </select>
                <input type="text" placeholder="輸入題目內容" value={newQText} onChange={(e) => setNewQText(e.target.value)} className="game-input" />
                {qType === 'choice' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
                      <input type="text" placeholder="選項 A" value={newOptA} onChange={(e) => setNewOptA(e.target.value)} className="game-input" style={{ marginBottom: 0 }} />
                      <input type="text" placeholder="選項 B" value={newOptB} onChange={(e) => setNewOptB(e.target.value)} className="game-input" style={{ marginBottom: 0 }} />
                      <input type="text" placeholder="選項 C" value={newOptC} onChange={(e) => setNewOptC(e.target.value)} className="game-input" style={{ marginBottom: 0 }} />
                      <input type="text" placeholder="選項 D" value={newOptD} onChange={(e) => setNewOptD(e.target.value)} className="game-input" style={{ marginBottom: 0 }} />
                    </div>
                    <select value={newAns} onChange={(e) => setNewAns(e.target.value)} className="game-input" style={{ marginTop: '10px' }}>
                      <option value="A">正解: A</option><option value="B">正解: B</option><option value="C">正解: C</option><option value="D">正解: D</option>
                    </select>
                  </>
                )}
                <button className="btn-summon" onClick={handleAddQuestion} style={{ marginTop: '10px', background: '#2ecc71' }}>💾 儲存題目</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(qBank || []).map((q: any, idx: number) => (
                  <div key={q?.id || idx} style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px', textAlign: 'left', borderLeft: `4px solid ${q?.type==='match'?'#9b59b6':'#FFD700'}`, position: 'relative' }}>
                    <p style={{ fontWeight: 'bold' }}>Q{idx + 1} [{q?.type==='match'?'配對':'單選'}]. {q?.text}</p>
                    <button onClick={() => socket.emit('admin_del_q', q?.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: '#e74c3c', color: 'white', border: 'none', padding: '5px', borderRadius: '5px' }}>刪除</button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </ErrorBoundary>
  );
}