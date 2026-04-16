import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './index.css'; // 👈 關鍵：獨立引入 CSS，避免打包工具解析錯亂

const socket: Socket = io('https://swtest-pgq8.onrender.com'); 

class ErrorBoundary extends React.Component<any, { hasError: boolean, errorMsg: string }> {
  constructor(props: any) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error: any) { return { hasError: true, errorMsg: error.toString() }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("React Error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', background: '#2c3e50', color: 'white', minHeight: '100vh', textAlign: 'center' }}>
          <h2 style={{ color: '#e74c3c' }}>❌ 致命錯誤</h2>
          <p style={{ background: '#000', padding: '1rem', color: '#e74c3c' }}>{this.state.errorMsg}</p>
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px' }}>重新整理</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState<string[]>([]);
  
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
    socket.on('player_joined', (data) => { if (!data?.isHost) setPlayers((prev) => [...(prev || []), data?.username]); });
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
  const handleChoiceClick = (answerId: string) => { if (!hasAnswered) { setHasAnswered(true); socket.emit('submit_answer', { pin, answerData: answerId }); } };
  const handleMatchSubmit = () => { if (!hasAnswered) { setHasAnswered(true); socket.emit('submit_answer', { pin, answerData: userMatches }); } };

  const handleTopClick = (id: string) => setActiveTopId(id === activeTopId ? null : id);
  const handleBottomClick = (bottomId: string) => {
    setUserMatches(prev => {
      const newMatches = { ...prev };
      let existingTopKey = null;
      for (const key in newMatches) { if (newMatches[key] === bottomId) existingTopKey = key; }
      if (existingTopKey) delete newMatches[existingTopKey];
      if (activeTopId) { newMatches[activeTopId] = bottomId; setActiveTopId(null); }
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
        correctAnswer: newAns,
        options: [
          { id: 'A', text: newOptA || 'A', color: '#e53e3e' }, { id: 'B', text: newOptB || 'B', color: '#3182ce' },
          { id: 'C', text: newOptC || 'C', color: '#d69e2e' }, { id: 'D', text: newOptD || 'D', color: '#805ad5' }
        ]
      } : {
        topItems: [{id: 'T1', name:'魔靈 A'}, {id: 'T2', name:'魔靈 B'}, {id: 'T3', name:'魔靈 C'}, {id: 'T4', name:'魔靈 D'}],
        bottomItems: [{id: 'B1'}, {id: 'B2'}, {id: 'B3'}, {id: 'B4'}],
        correctMatches: { 'T1':'B1', 'T2':'B2', 'T3':'B3', 'T4':'B4' }
      })
    };
    socket.emit('admin_add_q', qData);
    setNewQText('');
  };

  const topColors: Record<string, string> = { 'T1': '#e74c3c', 'T2': '#3498db', 'T3': '#f1c40f', 'T4': '#9b59b6' };

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
          
          {/* 大廳首頁 */}
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

          {/* 大廳等待中 */}
          {viewMode === 'home' && isJoined && !currentQuestion && !leaderboard && !reviewData && !podiumData && (
            <div className="game-panel" style={{ maxWidth: '400px' }}>
              <h2 style={{ color: '#FFD700', fontSize: '1.8rem', marginBottom: '1rem' }}>房號: {pin}</h2>
              {isHost ? <button className="btn-summon" onClick={handleSendQuestion}>▶️ 開始試煉</button> : <p style={{ fontSize: '1.3rem', color: '#3498db' }}>等待大師開啟試煉...</p>}
              <p style={{ color: '#bdc3c7', marginTop: '1rem' }}>已進場: {(players || []).length} 人</p>
            </div>
          )}

          {/* 答題介面 */}
          {viewMode === 'home' && isJoined && currentQuestion && !leaderboard && !reviewData && !podiumData && (
            <div className="game-panel">
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

              {/* 單選題 */}
              {currentQuestion?.type === 'choice' && !hasAnswered && !isHost && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {(currentQuestion?.options || []).map((opt: any, index: number) => (
                    <button key={opt?.id || index} onClick={() => handleChoiceClick(opt?.id)} style={{ padding: '1rem', fontSize: '1.1rem', color: '#fff', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', border: 'none', borderLeft: `6px solid ${opt?.color || '#fff'}`, cursor: 'pointer' }}>{opt?.text}</button>
                  ))}
                </div>
              )}

              {/* 配對題 */}
              {currentQuestion?.type === 'match' && !hasAnswered && !isHost && (
                <div>
                  <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '10px' }}>💡 點擊魔靈再點腿來配對</p>
                  <div className="match-grid">
                    {(currentQuestion?.topItems || []).map((item: any, index: number) => {
                      const isActive = activeTopId === item?.id;
                      const isMatched = Boolean(userMatches?.[item?.id]);
                      return (
                        <div key={item?.id || index} onClick={() => handleTopClick(item?.id)} className={`match-item ${isActive ? 'active' : ''}`} style={{ borderColor: isActive ? topColors[item?.id] : (isMatched ? '#2ecc71' : 'transparent') }}>
                          {item?.img && <img src={item.img} alt="top" />}
                          <p>{item?.name || `目標 ${index+1}`}</p>
                          {isMatched && <div className="match-badge" style={{ background: '#2ecc71' }}>✓</div>}
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
                          {item?.img && <img src={item.img} alt="bottom" />}
                          {matchedTopId && <div className="match-badge" style={{ background: topColors[matchedTopId] || '#fff' }}>{String(matchedTopId).replace('T', '')}</div>}
                        </div>
                      );
                    })}
                  </div>
                  <button className="btn-summon" onClick={handleMatchSubmit} disabled={Object.keys(userMatches || {}).length !== (currentQuestion?.topItems?.length || 4)} style={{ marginTop: '10px' }}>
                    {Object.keys(userMatches || {}).length === (currentQuestion?.topItems?.length || 4) ? '確認送出配對！' : '請完成所有配對...'}
                  </button>
                </div>
              )}

              {isHost && !answerResult && <button className="btn-summon" onClick={handleShowLeaderboard} style={{ background: '#9b59b6' }}>📊 結算當前排名</button>}
              
              {answerResult && (
                <div style={{ animation: 'bounceIn 0.8s ease' }}>
                  <h3 style={{ fontSize: '2rem', color: answerResult?.isCorrect ? '#2ecc71' : '#e74c3c' }}>{answerResult?.isCorrect ? `✨ 答對了！ +${answerResult?.earnedScore}` : '💀 殘念...'}</h3>
                </div>
              )}
            </div>
          )}

          {/* 排名結算 */}
          {viewMode === 'home' && isJoined && leaderboard && (
             <div className="game-panel">
             <h2 style={{ color: '#FFD700', fontSize: '2rem', marginBottom: '1.5rem' }}>🏆 排名結算</h2>
             {(leaderboard || []).map((player: any, index: number) => (
               <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem', borderRadius: '8px', borderLeft: index === 0 ? '5px solid #FFD700' : '5px solid #444', fontSize: '1.1rem' }}>
                 <span style={{ color: '#FFF' }}>#{index + 1} {player?.username}</span>
                 <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{player?.score}</span>
               </div>
             ))}
             {isHost && <button className="btn-summon" onClick={handleShowReview} style={{ marginTop: '1.5rem', background: '#34495e' }}>🔍 檢視戰報</button>}
           </div>
          )}

          {/* 復盤 */}
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
                 <p style={{ color: '#2ecc71', fontSize: '1.2rem' }}>配對題解答已公佈！</p>
              )}
              
              {isHost && reviewData?.hasNextQuestion ? (
                <button className="btn-summon" onClick={handleSendQuestion} style={{ marginTop: '1.5rem', background: '#2ecc71' }}>▶️ 下一題</button>
              ) : isHost ? (
                <button className="btn-summon" onClick={handleShowPodium} style={{ marginTop: '1.5rem', background: '#f1c40f' }}>🏆 揭曉最終榮耀</button>
              )}
            </div>
          )}

          {/* 頒獎台 */}
          {viewMode === 'home' && isJoined && podiumData && (
            <div className="game-panel">
              <h2 style={{ color: '#FFD700', fontSize: '2.2rem', marginBottom: '2rem' }}>傳奇誕生</h2>
              {podiumData?.[0] && <h3 style={{color: '#f1c40f', fontSize: '2rem'}}>🥇 {podiumData[0]?.username}</h3>}
              {podiumData?.[1] && <h4 style={{color: '#bdc3c7', fontSize: '1.5rem', marginTop: '10px'}}>🥈 {podiumData[1]?.username}</h4>}
              {podiumData?.[2] && <h4 style={{color: '#e67e22', fontSize: '1.2rem', marginTop: '10px'}}>🥉 {podiumData[2]?.username}</h4>}
            </div>
          )}

          {/* 後台介面 */}
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