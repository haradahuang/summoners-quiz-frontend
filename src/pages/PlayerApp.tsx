import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, sfx, unlockAudio, topColors, qTypeLabels, qTypeColors, DEFAULT_TITLE, DEFAULT_BG } from '../config';
import { PageLayout, LeaderboardView } from '../components';

// 💡 新增：集中管理各題型的作答提示
const qTypeInstructions: Record<string, string> = {
  choice: '💡 準備好手速，點擊最快最正確的選項',
  img_choice: '💡 仔細看圖，選出正確答案',
  tf: '💡 判斷對錯，二選一',
  multi: '💡 點擊選取多個答案，完成後點擊下方送出',
  guess: '💡 圖片會隨時間變清晰，越快答對分數越高',
  order: '💡 由上而下排出正確順序，完成後點擊送出',
  match: '💡 點擊相對應的圖片，進行正確配對'
};

export default function PlayerApp() {
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState<any[]>([]); 
  
  const [roomTitle, setRoomTitle] = useState(DEFAULT_TITLE);
  const [roomBg, setRoomBg] = useState(searchParams.get('pin') ? 'LOADING' : DEFAULT_BG);

  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareData, setPrepareData] = useState<any>(null);
  const [prepareTimeLeft, setPrepareTimeLeft] = useState(3);

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [podiumData, setPodiumData] = useState<any[] | null>(null);

  const [singleSelected, setSingleSelected] = useState<string>('');
  const [activeTopId, setActiveTopId] = useState<string | null>(null);
  const [userMatches, setUserMatches] = useState<Record<string, string>>({});
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [orderState, setOrderState] = useState<any[]>([]); 

  const [channel, setChannel] = useState<any>(null);
  const [myScore, setMyScore] = useState(0);

  const questionStartTimeRef = useRef<number>(0);

  const scoreRef = useRef(0);
  const singleRef = useRef('');
  const multiRef = useRef<string[]>([]);
  const orderRef = useRef<any[]>([]);
  const matchRef = useRef<Record<string, string>>({});

  useEffect(() => { scoreRef.current = myScore; }, [myScore]);
  useEffect(() => { singleRef.current = singleSelected; }, [singleSelected]);
  useEffect(() => { multiRef.current = multiSelected; }, [multiSelected]);
  useEffect(() => { orderRef.current = orderState; }, [orderState]);
  useEffect(() => { matchRef.current = userMatches; }, [userMatches]);

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
    if (!isJoined || !pin) return;

    const quizRoom = supabase.channel(`room_${pin}`, { config: { presence: { key: username } } });

    quizRoom
      .on('presence', { event: 'sync' }, () => {})
      .on('broadcast', { event: 'room_info' }, ({ payload }) => { setRoomTitle(payload.title || DEFAULT_TITLE); setRoomBg(payload.backgroundImg || DEFAULT_BG); })
      .on('broadcast', { event: 'prepare_question' }, ({ payload }) => {
        setIsPreparing(true); setPrepareData(payload); setPrepareTimeLeft(3);
        setAnswerResult(null); setLeaderboard(null); setReviewData(null); setPodiumData(null); setCurrentQuestion(null);
        setSingleSelected(''); setUserMatches({}); setActiveTopId(null); setMultiSelected([]); setOrderState([]); setHasAnswered(false);
        quizRoom.track({ isOnline: true });
      })
      .on('broadcast', { event: 'receive_question' }, ({ payload }) => {
        setIsPreparing(false); 
        const q = payload;
        if (q.type === 'match' && q.bottomItems) q.bottomItems = q.bottomItems.sort(() => Math.random() - 0.5);
        if (q.type === 'order' && q.options) setOrderState([...q.options].sort(() => Math.random() - 0.5));
        
        questionStartTimeRef.current = Date.now();
        setCurrentQuestion(q); setTimeLeft(q?.timeLimit || 15); setHasAnswered(false); 
      })
      .on('broadcast', { event: 'reveal_answer' }, ({ payload }) => {
        const q = payload.question; const stats = payload.stats || {}; const hostPlayers = payload.players || [];
        
        let isCorrect = false; let myAns: any = '';
        if (q.type === 'match') myAns = matchRef.current;
        else if (q.type === 'multi') myAns = multiRef.current;
        else if (q.type === 'order') myAns = orderRef.current.map(o => o.id).join(',');
        else myAns = singleRef.current;

        if (['choice', 'tf', 'guess', 'img_choice'].includes(q.type)) isCorrect = myAns === q.correctAnswer;
        else if (q.type === 'multi') isCorrect = Array.isArray(myAns) && myAns.length === q.correctAnswers.length && myAns.every(v => q.correctAnswers.includes(v));
        else if (q.type === 'order') isCorrect = myAns === q.correctAnswer;
        else if (q.type === 'match') isCorrect = JSON.stringify(myAns) === JSON.stringify(q.correctMatches);

        const me = hostPlayers.find((p: any) => p.username === username);
        if (me) setMyScore(me.score);

        setPlayers(hostPlayers);
        setAnswerResult({ isCorrect, earnedScore: isCorrect ? (me?.lastEarned || 0) : 0 });
        setReviewData({ question: q, stats });
      })
      .on('broadcast', { event: 'leaderboard_updated' }, ({ payload }) => { 
         setLeaderboard(payload); setPlayers(payload);
         const me = payload.find((p: any) => p.username === username); if (me) setMyScore(me.score);
      })
      .on('broadcast', { event: 'podium_updated' }, ({ payload }) => { setPodiumData(payload); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });

    quizRoom.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { await quizRoom.track({ isOnline: true }); quizRoom.send({ type: 'broadcast', event: 'player_joined', payload: { username } }); }
    });

    setChannel(quizRoom);
    return () => { quizRoom.unsubscribe(); };
  }, [isJoined, pin, username]); 

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (isPreparing && prepareTimeLeft > 0) timerId = setTimeout(() => setPrepareTimeLeft(prepareTimeLeft - 1), 1000);
    return () => clearTimeout(timerId);
  }, [isPreparing, prepareTimeLeft]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (currentQuestion && timeLeft > 0 && !hasAnswered && !leaderboard && !reviewData && !podiumData && !isPreparing) {
      timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000); 
      if (timeLeft <= 5) { sfx.tick.currentTime = 0; sfx.tick.play().catch(()=>{}); }
    } else { sfx.tick.pause(); }

    if (timeLeft === 0 && currentQuestion && !hasAnswered && !isPreparing) {
      setHasAnswered(true);
      if (channel) {
         const maxTimeMs = (currentQuestion.timeLimit || 15) * 1000;
         channel.send({ type: 'broadcast', event: 'player_answered', payload: { username, answer: null, responseTimeMs: maxTimeMs } }); 
      }
    }
    return () => clearTimeout(timerId);
  }, [currentQuestion, timeLeft, hasAnswered, leaderboard, reviewData, podiumData, isPreparing, channel, username]);

  const handleJoinArena = () => { if (username.trim() && pin.trim()) { setIsJoined(true); unlockAudio(); } };
  
  const submitPlayerAnswer = (actualAnswer: any) => {
    setHasAnswered(true);
    if (channel) {
      const responseTimeMs = Date.now() - questionStartTimeRef.current;
      channel.send({ type: 'broadcast', event: 'player_answered', payload: { username, answer: actualAnswer, responseTimeMs } });
    }
  };

  const handleChoiceClick = (answerId: string) => { if (!hasAnswered) { setSingleSelected(answerId); submitPlayerAnswer(answerId); } };
  const toggleMultiSelect = (optId: string) => { if (hasAnswered) return; setMultiSelected(prev => prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId]); };
  const handleMultiSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(multiSelected); } };
  const moveOrderUp = (index: number) => { if (index === 0 || hasAnswered) return; const newArr = [...orderState]; [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]]; setOrderState(newArr); };
  const moveOrderDown = (index: number) => { if (index === orderState.length - 1 || hasAnswered) return; const newArr = [...orderState]; [newArr[index + 1], newArr[index]] = [newArr[index], newArr[index + 1]]; setOrderState(newArr); };
  const handleOrderSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(orderState.map(o => o.id).join(',')); } };
  const handleMatchSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(userMatches); } };
  const handleTopClick = (id: string) => { setActiveTopId(id === activeTopId ? null : id); setUserMatches(prev => { const newMatches = { ...prev }; if (newMatches[id]) delete newMatches[id]; return newMatches; }); };
  const handleBottomClick = (bottomId: string) => { setUserMatches(prev => { const newMatches = { ...prev }; let existingTopKey = null; for (const key in newMatches) { if (newMatches[key] === bottomId) existingTopKey = key; } if (activeTopId) { if (existingTopKey) delete newMatches[existingTopKey]; newMatches[activeTopId] = bottomId; setActiveTopId(null); } else { if (existingTopKey) delete newMatches[existingTopKey]; } return newMatches; }); };
  const handleReturnToDashboard = () => { window.location.reload(); };

  const sortedPlayers = [...(players || [])].sort((a, b) => b.score - a.score);
  const myRank = sortedPlayers.findIndex(p => p.username === username) !== -1 ? sortedPlayers.findIndex(p => p.username === username) + 1 : '-';

  return (
    <PageLayout title={roomTitle} bgImg={roomBg}>
      {!isJoined && (
        <div className="game-panel login-panel" style={{ width: '95%', maxWidth: '400px', margin: '15vh auto 0', background: 'rgba(10, 15, 30, 0.85)' }}>
          <h2 style={{ color: '#FFD700', marginBottom: '1.5rem', fontSize: '2.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>進入競技場</h2> 
          <input type="text" placeholder="房間代碼 (PIN)" value={pin} onChange={(e) => setPin(e.target.value)} className="game-input" disabled={!!searchParams.get('pin')} />
          <input type="text" placeholder="您的召喚師暱稱 (限8字)" value={username} maxLength={8} onChange={(e) => setUsername(e.target.value.slice(0, 8))} className="game-input" />
          <button className="btn-summon" onClick={handleJoinArena} style={{ background: 'linear-gradient(90deg, #f39c12, #e67e22)' }}>Ready!</button> 
        </div>
      )}

      {isJoined && !isPreparing && !currentQuestion && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel login-panel" style={{ width: '95%', maxWidth: '400px', margin: '15vh auto 0', textAlign: 'center' }}>
          <h2 style={{ color: '#FFD700', fontSize: '2.2rem', marginBottom: '1rem', textShadow: '0 0 10px rgba(241,196,15,0.8)' }}>房號: {pin}</h2>
          <p style={{ fontSize: '1.4rem', color: '#3498db', fontWeight: 'bold' }}>連線成功，等待主持人開始...</p> 
        </div>
      )}

      {/* 💡 修改點 2：在準備畫面中加入題型專屬的操作說明 */}
      {isJoined && isPreparing && prepareData && (
        <div className="game-panel question-transition" style={{ width: '95%', maxWidth: '600px', margin: '2vh auto 0', textAlign: 'center', padding: '2rem 1rem' }}>
           <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚔️</div>
           <h2 style={{ fontSize: '2rem', color: '#bdc3c7', marginBottom: '1.5rem', letterSpacing: '2px' }}>準備迎接挑戰</h2>
           <div style={{ fontSize: '3.5rem', fontWeight: '900', color: qTypeColors[prepareData.type] || '#fff', textShadow: '0 0 20px rgba(255,255,255,0.3)', marginBottom: '1rem' }}>{qTypeLabels[prepareData.type]}</div>
           
           {/* 操作提示文字區塊 */}
           <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px 15px', borderRadius: '10px', display: 'inline-block', marginBottom: '1.5rem', border: '1px solid rgba(241, 196, 15, 0.3)' }}>
             <p style={{ color: '#f1c40f', fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
               {qTypeInstructions[prepareData.type]}
             </p>
           </div>

           <div style={{ fontSize: '6rem', color: '#f1c40f', textShadow: '0 4px 10px rgba(0,0,0,0.5)', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>{prepareTimeLeft}</div>
        </div>
      )}

      {isJoined && currentQuestion && !isPreparing && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel question-transition" style={{ width: '95%', maxWidth: '600px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1c40f', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '15px', borderBottom: '2px solid rgba(255,215,0,0.3)', paddingBottom: '10px' }}>
            <span>👤 {username}</span><span>🏆 {myScore} 分 | 🏅 #{myRank}</span>
          </div>
          
          <div style={{ position: 'relative', width: '100%', height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid rgba(255,215,0,0.5)' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #f39c12, #f1c40f)', width: `${((currentQuestion?.currentQIndex || 1) / (currentQuestion?.totalQuestions || 1)) * 100}%`, transition: 'width 0.5s' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '10px', marginBottom: '1rem', flexDirection: 'column' }}>
            <span style={{ background: qTypeColors[currentQuestion.type] || '#7f8c8d', color: '#fff', padding: '4px 12px', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '900', alignSelf: 'flex-start' }}>{qTypeLabels[currentQuestion.type] || '未知'}</span>
            <h2 style={{ color: '#FFFFFF', fontSize: '1.8rem', margin: 0, textAlign: 'left', lineHeight: '1.4' }}>{currentQuestion?.text}</h2>
          </div>
          
          <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ height: '100%', background: timeLeft <= 5 ? '#e74c3c' : '#2ecc71', width: `${(timeLeft / (currentQuestion?.timeLimit || 15)) * 100}%`, transition: 'width 1s linear' }} />
          </div>

          {(currentQuestion?.type === 'guess' || currentQuestion?.type === 'img_choice') && !hasAnswered && (
             <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                <div style={{ width: '100%', maxWidth: '350px', height: '200px', borderRadius: '15px', overflow: 'hidden', border: '2px solid #f1c40f', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <img src={currentQuestion.guessImg} alt="q" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: currentQuestion.type === 'guess' ? 'cover' : 'contain', width: currentQuestion.type === 'guess' ? '100%' : 'auto', filter: currentQuestion.type === 'guess' && !hasAnswered ? `blur(${(timeLeft / currentQuestion.timeLimit) * 25}px) grayscale(${(timeLeft / currentQuestion.timeLimit) * 100}%)` : 'none', transition: currentQuestion.type === 'guess' ? 'filter 1s linear' : 'none' }} />
                </div>
             </div>
          )}

          {hasAnswered ? (
            <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', padding: '2rem 1rem', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.4)', animation: 'pulse 2s infinite', marginTop: '1rem', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
               <div style={{ fontSize: '3rem', marginBottom: '5px' }}>⏳</div>
               <h3 style={{ color: '#FFD700', fontSize: '1.8rem', margin: '0 0 8px 0', textShadow: '0 2px 5px rgba(0,0,0,0.8)' }}>已答題</h3>
               <p style={{ color: '#FFFFFF', fontSize: '1rem', margin: 0, fontWeight: 'bold' }}>請稍待公布答案！</p>
            </div>
          ) : (
            <>
              {(currentQuestion?.type === 'choice' || currentQuestion?.type === 'guess' || currentQuestion?.type === 'img_choice') && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {(currentQuestion?.options || []).map((opt: any) => (
                    <button key={opt.id} onClick={() => handleChoiceClick(opt.id)} style={{ padding: '1.2rem 1rem', fontSize: '1.4rem', fontWeight: 'bold', color: '#FFFFFF', background: 'rgba(30, 40, 60, 0.8)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', borderLeft: `8px solid ${opt.color}`, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', transition: 'transform 0.1s' }}>{opt.text}</button>
                  ))}
                </div>
              )}

              {currentQuestion?.type === 'tf' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <button onClick={() => handleChoiceClick('O')} style={{ padding: '2rem', fontSize: '4.5rem', fontWeight: '900', color: '#ffffff', background: 'linear-gradient(145deg, #00e673, #00b359)', borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 0 #008040' }}>O</button>
                  <button onClick={() => handleChoiceClick('X')} style={{ padding: '2rem', fontSize: '4.5rem', fontWeight: '900', color: '#ffffff', background: 'linear-gradient(145deg, #ff4d4d, #e60000)', borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 0 #b30000' }}>X</button>
                </div>
              )}

              {currentQuestion?.type === 'multi' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* 💡 修改點 2：拔除原有的提示文字，保持畫面清爽 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {(currentQuestion?.options || []).map((opt: any) => {
                      const isSelected = multiSelected.includes(opt.id);
                      return (
                        <button key={opt.id} onClick={() => toggleMultiSelect(opt.id)} style={{ padding: '1.2rem 1rem', fontSize: '1.4rem', fontWeight: 'bold', color: '#FFFFFF', background: isSelected ? 'rgba(52, 152, 219, 0.6)' : 'rgba(30, 40, 60, 0.8)', borderRadius: '10px', border: isSelected ? '2px solid #3498db' : '1px solid rgba(255,255,255,0.1)', borderLeft: `8px solid ${opt.color}`, cursor: 'pointer', transition: 'all 0.2s' }}>{isSelected && '✔️ '} {opt.text}</button>
                      );
                    })}
                  </div>
                  <button className="btn-summon" onClick={handleMultiSubmit} disabled={multiSelected.length === 0} style={{ marginTop: '15px', fontSize: '1.4rem', background: multiSelected.length > 0 ? 'linear-gradient(90deg, #2ecc71, #27ae60)' : '#7f8c8d' }}>送出解答</button>
                </div>
              )}

              {currentQuestion?.type === 'order' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* 💡 修改點 2：拔除原有的提示文字 */}
                  {orderState.map((opt, idx) => (
                    <div key={opt.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(30, 40, 60, 0.8)', padding: '12px', borderRadius: '10px', borderLeft: `8px solid ${opt.color}` }}>
                      <span style={{ color: '#f1c40f', fontWeight: '900', marginRight: '10px', fontSize: '1.4rem', width: '25px' }}>{idx + 1}.</span>
                      <span style={{ color: '#FFFFFF', flex: 1, fontSize: '1.3rem', textAlign: 'left', fontWeight: 'bold' }}>{opt.text}</span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={() => moveOrderUp(idx)} disabled={idx === 0} style={{ padding:'10px 15px', background:'#3498db', border:'none', borderRadius:'6px', cursor: idx===0?'not-allowed':'pointer', opacity: idx===0?0.3:1 }}>⬆️</button>
                        <button onClick={() => moveOrderDown(idx)} disabled={idx === orderState.length - 1} style={{ padding:'10px 15px', background:'#e74c3c', border:'none', borderRadius:'6px', cursor: idx===orderState.length-1?'not-allowed':'pointer', opacity: idx===orderState.length-1?0.3:1 }}>⬇️</button>
                      </div>
                    </div>
                  ))}
                  <button className="btn-summon" onClick={handleOrderSubmit} style={{ marginTop: '15px', fontSize: '1.4rem', background: 'linear-gradient(90deg, #2ecc71, #27ae60)' }}>確認排序並送出</button>
                </div>
              )}

              {currentQuestion?.type === 'match' && (
                <div>
                  {/* 💡 修改點 2：拔除原有的提示文字 */}
                  <div className="match-grid">
                    {(currentQuestion?.topItems || []).map((item: any) => {
                      const isActive = activeTopId === item.id; const isMatched = Boolean(userMatches[item.id]); const itemColor = topColors[item.id] || '#fff';
                      return (
                        <div key={item.id} onClick={() => handleTopClick(item.id)} className={`match-item ${isActive ? 'active' : ''}`} style={{ borderColor: isActive || isMatched ? itemColor : 'transparent', background: 'rgba(30, 40, 60, 0.8)' }}>
                          <img src={item.img} alt="top" referrerPolicy="no-referrer" crossOrigin="anonymous" /> <p style={{ fontWeight: 'bold', color: '#FFF' }}>{item.name}</p> {isMatched && <div className="match-badge" style={{ background: itemColor }}>✓</div>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="match-grid">
                    {(currentQuestion?.bottomItems || []).map((item: any) => {
                      let matchedTopId = null; for (const k in userMatches) { if (userMatches[k] === item.id) matchedTopId = k; }
                      return (
                        <div key={item.id} onClick={() => handleBottomClick(item.id)} className="match-item" style={{ borderColor: matchedTopId ? topColors[matchedTopId] : 'transparent', background: 'rgba(30, 40, 60, 0.8)' }}>
                          <img src={item.img} alt="bottom" referrerPolicy="no-referrer" crossOrigin="anonymous" /> {matchedTopId && <div className="match-badge" style={{ background: topColors[matchedTopId] || '#fff' }}>✓</div>}
                        </div>
                      );
                    })}
                  </div>
                  <button className="btn-summon" onClick={handleMatchSubmit} disabled={Object.keys(userMatches).length !== currentQuestion?.topItems?.length} style={{ marginTop: '15px', fontSize: '1.4rem', background: Object.keys(userMatches).length !== currentQuestion?.topItems?.length ? '#7f8c8d' : 'linear-gradient(90deg, #3498db, #2980b9)' }}>確認送出配對！</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isJoined && reviewData && !leaderboard && !podiumData && (
        <div className="game-panel" style={{ width: '95%', maxWidth: '600px', margin: '0 auto', paddingBottom: '1rem', textAlign: 'center' }}>
          
          <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: answerResult?.isCorrect ? '#2ecc71' : '#ff4d4d' }}>
              {answerResult?.isCorrect ? '🟢 答對了！' : '🔴 答錯了！'}
            </div>
            <div style={{ fontSize: '4rem', fontWeight: '900', color: answerResult?.isCorrect ? '#FFD700' : '#bdc3c7', textShadow: '0 4px 10px rgba(0,0,0,0.6)' }}>
              + {answerResult?.earnedScore || 0} 分
            </div>
          </div>
          
          <p style={{ color: '#fff', fontSize: '1.3rem', marginBottom: '20px', fontWeight: 'bold' }}>目前總積分：{myScore} 分</p>
          
          <div style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '12px' }}>
             <p style={{ color: '#3498db', fontWeight: 'bold', margin: '0 0 10px 0', fontSize: '1.1rem' }}>📊 本題全服答題統計：</p>
             {(reviewData.question.type === 'choice' || reviewData.question.type === 'multi' || reviewData.question.type === 'guess' || reviewData.question.type === 'img_choice') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reviewData.question.options.map((opt: any) => {
                    const isC = reviewData.question.type === 'multi' ? reviewData.question.correctAnswers.includes(opt.id) : opt.id === reviewData.question.correctAnswer;
                    return (<div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: isC ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255,255,255,0.05)', border: isC ? '2px solid #2ecc71' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px' }}><span style={{ color: isC ? '#2ecc71' : '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>{isC && '✔️ '} {opt.text}</span><span style={{ color: '#bdc3c7', fontWeight: 'bold', fontSize: '1.2rem' }}>{reviewData.stats[opt.id] || 0} 人</span></div>);
                  })}
                </div>
             )}
             {reviewData.question.type === 'tf' && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', marginTop: '15px' }}>
                  <span style={{ fontSize: '1.8rem', color: reviewData.question.correctAnswer === 'O' ? '#2ecc71' : '#bdc3c7', fontWeight: 'bold' }}>O : {reviewData.stats['O'] || 0} 人 {reviewData.question.correctAnswer === 'O' && '✔️'}</span>
                  <span style={{ fontSize: '1.8rem', color: reviewData.question.correctAnswer === 'X' ? '#2ecc71' : '#bdc3c7', fontWeight: 'bold' }}>X : {reviewData.stats['X'] || 0} 人 {reviewData.question.correctAnswer === 'X' && '✔️'}</span>
                </div>
             )}
          </div>
        </div>
      )}

      {isJoined && leaderboard && !podiumData && (
         <div className="game-panel" style={{ width: '95%', maxWidth: '600px', margin: '0 auto', paddingBottom: '1rem' }}>
           <h2 style={{ color: '#FFD700', fontSize: '2rem', marginBottom: '1.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>🏆 排名結算</h2>
           <LeaderboardView data={leaderboard} />
         </div>
      )}

      {isJoined && podiumData && (
        <div className="game-panel" style={{ width: '95%', maxWidth: '600px', margin: '0 auto', animation: 'bounceIn 1s ease', position: 'relative' }}>
          <div className="firework fw-1">🎆</div><div className="firework fw-2">🎇</div>
          <div className="podium-content">
            <h2 style={{ color: '#FFD700', fontSize: '2.5rem', marginBottom: '2rem' }}>🏆 傳奇誕生 🏆</h2>
            {podiumData.map((p, idx) => {
              if (idx === 0) {
                return (
                  <h3 key={p.username} style={{color: '#f1c40f', fontSize: '2.2rem', margin: '10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.8)'}}>
                    🥇 {p.username} <span style={{fontSize:'1.2rem'}}>({p.score}分)</span>
                  </h3>
                );
              }
              const icons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
              const color = idx === 1 ? '#bdc3c7' : idx === 2 ? '#e67e22' : '#ecf0f1';
              return (
                <h4 key={p.username} style={{color, fontSize: '1.3rem', margin: '5px 0', fontWeight: 'bold'}}>
                  {icons[idx]} {p.username} <span style={{fontSize:'0.9rem'}}>({p.score}分)</span>
                </h4>
              );
            })}
          </div>
          <button className="btn-summon" onClick={handleReturnToDashboard} style={{ background: 'linear-gradient(90deg, #3498db, #2980b9)', marginTop: '30px', fontSize: '1.3rem', padding: '10px 20px' }}>🏠 返回大廳</button>
        </div>
      )}
    </PageLayout>
  );
}
import { supabase, sfx, unlockAudio, topColors, qTypeLabels, qTypeColors, DEFAULT_TITLE, DEFAULT_BG } from '../config';
import { PageLayout, LeaderboardView } from '../components';

// 💡 新增：集中管理各題型的作答提示import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase, sfx, unlockAudio, topColors, qTypeLabels, qTypeColors, DEFAULT_TITLE, DEFAULT_BG } from '../config';
import { PageLayout, LeaderboardView } from '../components';

// 💡 新增：集中管理各題型的作答提示
const qTypeInstructions: Record<string, string> = {
  choice: '💡 準備好手速，點擊最快最正確的選項',
  img_choice: '💡 仔細看圖，選出正確答案',
  tf: '💡 判斷對錯，二選一',
  multi: '💡 點擊選取多個答案，完成後點擊下方送出',
  guess: '💡 圖片會隨時間變清晰，越快答對分數越高',
  order: '💡 由上而下排出正確順序，完成後點擊送出',
  match: '💡 先點擊上方魔靈，再點擊下方圖片進行配對'
};

export default function PlayerApp() {
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState<any[]>([]); 
  
  const [roomTitle, setRoomTitle] = useState(DEFAULT_TITLE);
  const [roomBg, setRoomBg] = useState(searchParams.get('pin') ? 'LOADING' : DEFAULT_BG);

  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareData, setPrepareData] = useState<any>(null);
  const [prepareTimeLeft, setPrepareTimeLeft] = useState(3);

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [podiumData, setPodiumData] = useState<any[] | null>(null);

  const [singleSelected, setSingleSelected] = useState<string>('');
  const [activeTopId, setActiveTopId] = useState<string | null>(null);
  const [userMatches, setUserMatches] = useState<Record<string, string>>({});
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [orderState, setOrderState] = useState<any[]>([]); 

  const [channel, setChannel] = useState<any>(null);
  const [myScore, setMyScore] = useState(0);

  const questionStartTimeRef = useRef<number>(0);

  const scoreRef = useRef(0);
  const singleRef = useRef('');
  const multiRef = useRef<string[]>([]);
  const orderRef = useRef<any[]>([]);
  const matchRef = useRef<Record<string, string>>({});

  useEffect(() => { scoreRef.current = myScore; }, [myScore]);
  useEffect(() => { singleRef.current = singleSelected; }, [singleSelected]);
  useEffect(() => { multiRef.current = multiSelected; }, [multiSelected]);
  useEffect(() => { orderRef.current = orderState; }, [orderState]);
  useEffect(() => { matchRef.current = userMatches; }, [userMatches]);

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
    if (!isJoined || !pin) return;

    const quizRoom = supabase.channel(`room_${pin}`, { config: { presence: { key: username } } });

    quizRoom
      .on('presence', { event: 'sync' }, () => {})
      .on('broadcast', { event: 'room_info' }, ({ payload }) => { setRoomTitle(payload.title || DEFAULT_TITLE); setRoomBg(payload.backgroundImg || DEFAULT_BG); })
      .on('broadcast', { event: 'prepare_question' }, ({ payload }) => {
        setIsPreparing(true); setPrepareData(payload); setPrepareTimeLeft(3);
        setAnswerResult(null); setLeaderboard(null); setReviewData(null); setPodiumData(null); setCurrentQuestion(null);
        setSingleSelected(''); setUserMatches({}); setActiveTopId(null); setMultiSelected([]); setOrderState([]); setHasAnswered(false);
        quizRoom.track({ isOnline: true });
      })
      .on('broadcast', { event: 'receive_question' }, ({ payload }) => {
        setIsPreparing(false); 
        const q = payload;
        if (q.type === 'match' && q.bottomItems) q.bottomItems = q.bottomItems.sort(() => Math.random() - 0.5);
        if (q.type === 'order' && q.options) setOrderState([...q.options].sort(() => Math.random() - 0.5));
        
        questionStartTimeRef.current = Date.now();
        setCurrentQuestion(q); setTimeLeft(q?.timeLimit || 15); setHasAnswered(false); 
      })
      .on('broadcast', { event: 'reveal_answer' }, ({ payload }) => {
        const q = payload.question; const stats = payload.stats || {}; const hostPlayers = payload.players || [];
        
        let isCorrect = false; let myAns: any = '';
        if (q.type === 'match') myAns = matchRef.current;
        else if (q.type === 'multi') myAns = multiRef.current;
        else if (q.type === 'order') myAns = orderRef.current.map(o => o.id).join(',');
        else myAns = singleRef.current;

        if (['choice', 'tf', 'guess', 'img_choice'].includes(q.type)) isCorrect = myAns === q.correctAnswer;
        else if (q.type === 'multi') isCorrect = Array.isArray(myAns) && myAns.length === q.correctAnswers.length && myAns.every(v => q.correctAnswers.includes(v));
        else if (q.type === 'order') isCorrect = myAns === q.correctAnswer;
        else if (q.type === 'match') isCorrect = JSON.stringify(myAns) === JSON.stringify(q.correctMatches);

        const me = hostPlayers.find((p: any) => p.username === username);
        if (me) setMyScore(me.score);

        setPlayers(hostPlayers);
        setAnswerResult({ isCorrect, earnedScore: isCorrect ? (me?.lastEarned || 0) : 0 });
        setReviewData({ question: q, stats });
      })
      .on('broadcast', { event: 'leaderboard_updated' }, ({ payload }) => { 
         setLeaderboard(payload); setPlayers(payload);
         const me = payload.find((p: any) => p.username === username); if (me) setMyScore(me.score);
      })
      .on('broadcast', { event: 'podium_updated' }, ({ payload }) => { setPodiumData(payload); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });

    quizRoom.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { await quizRoom.track({ isOnline: true }); quizRoom.send({ type: 'broadcast', event: 'player_joined', payload: { username } }); }
    });

    setChannel(quizRoom);
    return () => { quizRoom.unsubscribe(); };
  }, [isJoined, pin, username]); 

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (isPreparing && prepareTimeLeft > 0) timerId = setTimeout(() => setPrepareTimeLeft(prepareTimeLeft - 1), 1000);
    return () => clearTimeout(timerId);
  }, [isPreparing, prepareTimeLeft]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (currentQuestion && timeLeft > 0 && !hasAnswered && !leaderboard && !reviewData && !podiumData && !isPreparing) {
      timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000); 
      if (timeLeft <= 5) { sfx.tick.currentTime = 0; sfx.tick.play().catch(()=>{}); }
    } else { sfx.tick.pause(); }

    if (timeLeft === 0 && currentQuestion && !hasAnswered && !isPreparing) {
      setHasAnswered(true);
      if (channel) {
         const maxTimeMs = (currentQuestion.timeLimit || 15) * 1000;
         channel.send({ type: 'broadcast', event: 'player_answered', payload: { username, answer: null, responseTimeMs: maxTimeMs } }); 
      }
    }
    return () => clearTimeout(timerId);
  }, [currentQuestion, timeLeft, hasAnswered, leaderboard, reviewData, podiumData, isPreparing, channel, username]);

  const handleJoinArena = () => { if (username.trim() && pin.trim()) { setIsJoined(true); unlockAudio(); } };
  
  const submitPlayerAnswer = (actualAnswer: any) => {
    setHasAnswered(true);
    if (channel) {
      const responseTimeMs = Date.now() - questionStartTimeRef.current;
      channel.send({ type: 'broadcast', event: 'player_answered', payload: { username, answer: actualAnswer, responseTimeMs } });
    }
  };

  const handleChoiceClick = (answerId: string) => { if (!hasAnswered) { setSingleSelected(answerId); submitPlayerAnswer(answerId); } };
  const toggleMultiSelect = (optId: string) => { if (hasAnswered) return; setMultiSelected(prev => prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId]); };
  const handleMultiSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(multiSelected); } };
  const moveOrderUp = (index: number) => { if (index === 0 || hasAnswered) return; const newArr = [...orderState]; [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]]; setOrderState(newArr); };
  const moveOrderDown = (index: number) => { if (index === orderState.length - 1 || hasAnswered) return; const newArr = [...orderState]; [newArr[index + 1], newArr[index]] = [newArr[index], newArr[index + 1]]; setOrderState(newArr); };
  const handleOrderSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(orderState.map(o => o.id).join(',')); } };
  const handleMatchSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(userMatches); } };
  const handleTopClick = (id: string) => { setActiveTopId(id === activeTopId ? null : id); setUserMatches(prev => { const newMatches = { ...prev }; if (newMatches[id]) delete newMatches[id]; return newMatches; }); };
  const handleBottomClick = (bottomId: string) => { setUserMatches(prev => { const newMatches = { ...prev }; let existingTopKey = null; for (const key in newMatches) { if (newMatches[key] === bottomId) existingTopKey = key; } if (activeTopId) { if (existingTopKey) delete newMatches[existingTopKey]; newMatches[activeTopId] = bottomId; setActiveTopId(null); } else { if (existingTopKey) delete newMatches[existingTopKey]; } return newMatches; }); };
  const handleReturnToDashboard = () => { window.location.reload(); };

  const sortedPlayers = [...(players || [])].sort((a, b) => b.score - a.score);
  const myRank = sortedPlayers.findIndex(p => p.username === username) !== -1 ? sortedPlayers.findIndex(p => p.username === username) + 1 : '-';

  return (
    <PageLayout title={roomTitle} bgImg={roomBg}>
      {!isJoined && (
        <div className="game-panel login-panel" style={{ width: '95%', maxWidth: '400px', margin: '15vh auto 0', background: 'rgba(10, 15, 30, 0.85)' }}>
          <h2 style={{ color: '#FFD700', marginBottom: '1.5rem', fontSize: '2.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>進入競技場</h2> 
          <input type="text" placeholder="房間代碼 (PIN)" value={pin} onChange={(e) => setPin(e.target.value)} className="game-input" disabled={!!searchParams.get('pin')} />
          <input type="text" placeholder="您的召喚師暱稱 (限8字)" value={username} maxLength={8} onChange={(e) => setUsername(e.target.value.slice(0, 8))} className="game-input" />
          <button className="btn-summon" onClick={handleJoinArena} style={{ background: 'linear-gradient(90deg, #f39c12, #e67e22)' }}>Ready!</button> 
        </div>
      )}

      {isJoined && !isPreparing && !currentQuestion && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel login-panel" style={{ width: '95%', maxWidth: '400px', margin: '15vh auto 0', textAlign: 'center' }}>
          <h2 style={{ color: '#FFD700', fontSize: '2.2rem', marginBottom: '1rem', textShadow: '0 0 10px rgba(241,196,15,0.8)' }}>房號: {pin}</h2>
          <p style={{ fontSize: '1.4rem', color: '#3498db', fontWeight: 'bold' }}>連線成功，等待主持人開始...</p> 
        </div>
      )}

      {/* 💡 修改點 2：在準備畫面中加入題型專屬的操作說明 */}
      {isJoined && isPreparing && prepareData && (
        <div className="game-panel question-transition" style={{ width: '95%', maxWidth: '600px', margin: '2vh auto 0', textAlign: 'center', padding: '2rem 1rem' }}>
           <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚔️</div>
           <h2 style={{ fontSize: '2rem', color: '#bdc3c7', marginBottom: '1.5rem', letterSpacing: '2px' }}>準備迎接挑戰</h2>
           <div style={{ fontSize: '3.5rem', fontWeight: '900', color: qTypeColors[prepareData.type] || '#fff', textShadow: '0 0 20px rgba(255,255,255,0.3)', marginBottom: '1rem' }}>{qTypeLabels[prepareData.type]}</div>
           
           {/* 操作提示文字區塊 */}
           <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px 15px', borderRadius: '10px', display: 'inline-block', marginBottom: '1.5rem', border: '1px solid rgba(241, 196, 15, 0.3)' }}>
             <p style={{ color: '#f1c40f', fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
               {qTypeInstructions[prepareData.type]}
             </p>
           </div>

           <div style={{ fontSize: '6rem', color: '#f1c40f', textShadow: '0 4px 10px rgba(0,0,0,0.5)', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>{prepareTimeLeft}</div>
        </div>
      )}

      {isJoined && currentQuestion && !isPreparing && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel question-transition" style={{ width: '95%', maxWidth: '600px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1c40f', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '15px', borderBottom: '2px solid rgba(255,215,0,0.3)', paddingBottom: '10px' }}>
            <span>👤 {username}</span><span>🏆 {myScore} 分 | 🏅 #{myRank}</span>
          </div>
          
          <div style={{ position: 'relative', width: '100%', height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid rgba(255,215,0,0.5)' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #f39c12, #f1c40f)', width: `${((currentQuestion?.currentQIndex || 1) / (currentQuestion?.totalQuestions || 1)) * 100}%`, transition: 'width 0.5s' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '10px', marginBottom: '1rem', flexDirection: 'column' }}>
            <span style={{ background: qTypeColors[currentQuestion.type] || '#7f8c8d', color: '#fff', padding: '4px 12px', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '900', alignSelf: 'flex-start' }}>{qTypeLabels[currentQuestion.type] || '未知'}</span>
            <h2 style={{ color: '#FFFFFF', fontSize: '1.8rem', margin: 0, textAlign: 'left', lineHeight: '1.4' }}>{currentQuestion?.text}</h2>
          </div>
          
          <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ height: '100%', background: timeLeft <= 5 ? '#e74c3c' : '#2ecc71', width: `${(timeLeft / (currentQuestion?.timeLimit || 15)) * 100}%`, transition: 'width 1s linear' }} />
          </div>

          {(currentQuestion?.type === 'guess' || currentQuestion?.type === 'img_choice') && !hasAnswered && (
             <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                <div style={{ width: '100%', maxWidth: '350px', height: '200px', borderRadius: '15px', overflow: 'hidden', border: '2px solid #f1c40f', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <img src={currentQuestion.guessImg} alt="q" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: currentQuestion.type === 'guess' ? 'cover' : 'contain', width: currentQuestion.type === 'guess' ? '100%' : 'auto', filter: currentQuestion.type === 'guess' && !hasAnswered ? `blur(${(timeLeft / currentQuestion.timeLimit) * 25}px) grayscale(${(timeLeft / currentQuestion.timeLimit) * 100}%)` : 'none', transition: currentQuestion.type === 'guess' ? 'filter 1s linear' : 'none' }} />
                </div>
             </div>
          )}

          {hasAnswered ? (
            <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', padding: '2rem 1rem', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.4)', animation: 'pulse 2s infinite', marginTop: '1rem', textAlign: 'center', boxShadow: '0 10px 2
const qTypeInstructions: Record<string, string> = {
  choice: '💡 準備好手速，點擊最快最正確的選項',
  img_choice: '💡 仔細看圖，選出正確答案',
  tf: '💡 判斷對錯，二選一',
  multi: '💡 點擊選取多個答案，完成後點擊下方送出',
  guess: '💡 圖片會隨時間變清晰，越快答對分數越高',
  order: '💡 由上而下排出正確順序，完成後點擊送出',
  match: '💡 先點擊上方魔靈，再點擊下方圖片進行配對'
};

export default function PlayerApp() {
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState<any[]>([]); 
  
  const [roomTitle, setRoomTitle] = useState(DEFAULT_TITLE);
  const [roomBg, setRoomBg] = useState(searchParams.get('pin') ? 'LOADING' : DEFAULT_BG);

  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareData, setPrepareData] = useState<any>(null);
  const [prepareTimeLeft, setPrepareTimeLeft] = useState(3);

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [podiumData, setPodiumData] = useState<any[] | null>(null);

  const [singleSelected, setSingleSelected] = useState<string>('');
  const [activeTopId, setActiveTopId] = useState<string | null>(null);
  const [userMatches, setUserMatches] = useState<Record<string, string>>({});
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [orderState, setOrderState] = useState<any[]>([]); 

  const [channel, setChannel] = useState<any>(null);
  const [myScore, setMyScore] = useState(0);

  const questionStartTimeRef = useRef<number>(0);

  const scoreRef = useRef(0);
  const singleRef = useRef('');
  const multiRef = useRef<string[]>([]);
  const orderRef = useRef<any[]>([]);
  const matchRef = useRef<Record<string, string>>({});

  useEffect(() => { scoreRef.current = myScore; }, [myScore]);
  useEffect(() => { singleRef.current = singleSelected; }, [singleSelected]);
  useEffect(() => { multiRef.current = multiSelected; }, [multiSelected]);
  useEffect(() => { orderRef.current = orderState; }, [orderState]);
  useEffect(() => { matchRef.current = userMatches; }, [userMatches]);

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
    if (!isJoined || !pin) return;

    const quizRoom = supabase.channel(`room_${pin}`, { config: { presence: { key: username } } });

    quizRoom
      .on('presence', { event: 'sync' }, () => {})
      .on('broadcast', { event: 'room_info' }, ({ payload }) => { setRoomTitle(payload.title || DEFAULT_TITLE); setRoomBg(payload.backgroundImg || DEFAULT_BG); })
      .on('broadcast', { event: 'prepare_question' }, ({ payload }) => {
        setIsPreparing(true); setPrepareData(payload); setPrepareTimeLeft(3);
        setAnswerResult(null); setLeaderboard(null); setReviewData(null); setPodiumData(null); setCurrentQuestion(null);
        setSingleSelected(''); setUserMatches({}); setActiveTopId(null); setMultiSelected([]); setOrderState([]); setHasAnswered(false);
        quizRoom.track({ isOnline: true });
      })
      .on('broadcast', { event: 'receive_question' }, ({ payload }) => {
        setIsPreparing(false); 
        const q = payload;
        if (q.type === 'match' && q.bottomItems) q.bottomItems = q.bottomItems.sort(() => Math.random() - 0.5);
        if (q.type === 'order' && q.options) setOrderState([...q.options].sort(() => Math.random() - 0.5));
        
        questionStartTimeRef.current = Date.now();
        setCurrentQuestion(q); setTimeLeft(q?.timeLimit || 15); setHasAnswered(false); 
      })
      .on('broadcast', { event: 'reveal_answer' }, ({ payload }) => {
        const q = payload.question; const stats = payload.stats || {}; const hostPlayers = payload.players || [];
        
        let isCorrect = false; let myAns: any = '';
        if (q.type === 'match') myAns = matchRef.current;
        else if (q.type === 'multi') myAns = multiRef.current;
        else if (q.type === 'order') myAns = orderRef.current.map(o => o.id).join(',');
        else myAns = singleRef.current;

        if (['choice', 'tf', 'guess', 'img_choice'].includes(q.type)) isCorrect = myAns === q.correctAnswer;
        else if (q.type === 'multi') isCorrect = Array.isArray(myAns) && myAns.length === q.correctAnswers.length && myAns.every(v => q.correctAnswers.includes(v));
        else if (q.type === 'order') isCorrect = myAns === q.correctAnswer;
        else if (q.type === 'match') isCorrect = JSON.stringify(myAns) === JSON.stringify(q.correctMatches);

        const me = hostPlayers.find((p: any) => p.username === username);
        if (me) setMyScore(me.score);

        setPlayers(hostPlayers);
        setAnswerResult({ isCorrect, earnedScore: isCorrect ? (me?.lastEarned || 0) : 0 });
        setReviewData({ question: q, stats });
      })
      .on('broadcast', { event: 'leaderboard_updated' }, ({ payload }) => { 
         setLeaderboard(payload); setPlayers(payload);
         const me = payload.find((p: any) => p.username === username); if (me) setMyScore(me.score);
      })
      .on('broadcast', { event: 'podium_updated' }, ({ payload }) => { setPodiumData(payload); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });

    quizRoom.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { await quizRoom.track({ isOnline: true }); quizRoom.send({ type: 'broadcast', event: 'player_joined', payload: { username } }); }
    });

    setChannel(quizRoom);
    return () => { quizRoom.unsubscribe(); };
  }, [isJoined, pin, username]); 

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (isPreparing && prepareTimeLeft > 0) timerId = setTimeout(() => setPrepareTimeLeft(prepareTimeLeft - 1), 1000);
    return () => clearTimeout(timerId);
  }, [isPreparing, prepareTimeLeft]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (currentQuestion && timeLeft > 0 && !hasAnswered && !leaderboard && !reviewData && !podiumData && !isPreparing) {
      timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000); 
      if (timeLeft <= 5) { sfx.tick.currentTime = 0; sfx.tick.play().catch(()=>{}); }
    } else { sfx.tick.pause(); }

    if (timeLeft === 0 && currentQuestion && !hasAnswered && !isPreparing) {
      setHasAnswered(true);
      if (channel) {
         const maxTimeMs = (currentQuestion.timeLimit || 15) * 1000;
         channel.send({ type: 'broadcast', event: 'player_answered', payload: { username, answer: null, responseTimeMs: maxTimeMs } }); 
      }
    }
    return () => clearTimeout(timerId);
  }, [currentQuestion, timeLeft, hasAnswered, leaderboard, reviewData, podiumData, isPreparing, channel, username]);

  const handleJoinArena = () => { if (username.trim() && pin.trim()) { setIsJoined(true); unlockAudio(); } };
  
  const submitPlayerAnswer = (actualAnswer: any) => {
    setHasAnswered(true);
    if (channel) {
      const responseTimeMs = Date.now() - questionStartTimeRef.current;
      channel.send({ type: 'broadcast', event: 'player_answered', payload: { username, answer: actualAnswer, responseTimeMs } });
    }
  };

  const handleChoiceClick = (answerId: string) => { if (!hasAnswered) { setSingleSelected(answerId); submitPlayerAnswer(answerId); } };
  const toggleMultiSelect = (optId: string) => { if (hasAnswered) return; setMultiSelected(prev => prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId]); };
  const handleMultiSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(multiSelected); } };
  const moveOrderUp = (index: number) => { if (index === 0 || hasAnswered) return; const newArr = [...orderState]; [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]]; setOrderState(newArr); };
  const moveOrderDown = (index: number) => { if (index === orderState.length - 1 || hasAnswered) return; const newArr = [...orderState]; [newArr[index + 1], newArr[index]] = [newArr[index], newArr[index + 1]]; setOrderState(newArr); };
  const handleOrderSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(orderState.map(o => o.id).join(',')); } };
  const handleMatchSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(userMatches); } };
  const handleTopClick = (id: string) => { setActiveTopId(id === activeTopId ? null : id); setUserMatches(prev => { const newMatches = { ...prev }; if (newMatches[id]) delete newMatches[id]; return newMatches; }); };
  const handleBottomClick = (bottomId: string) => { setUserMatches(prev => { const newMatches = { ...prev }; let existingTopKey = null; for (const key in newMatches) { if (newMatches[key] === bottomId) existingTopKey = key; } if (activeTopId) { if (existingTopKey) delete newMatches[existingTopKey]; newMatches[activeTopId] = bottomId; setActiveTopId(null); } else { if (existingTopKey) delete newMatches[existingTopKey]; } return newMatches; }); };
  const handleReturnToDashboard = () => { window.location.reload(); };

  const sortedPlayers = [...(players || [])].sort((a, b) => b.score - a.score);
  const myRank = sortedPlayers.findIndex(p => p.username === username) !== -1 ? sortedPlayers.findIndex(p => p.username === username) + 1 : '-';

  return (
    <PageLayout title={roomTitle} bgImg={roomBg}>
      {!isJoined && (
        <div className="game-panel login-panel" style={{ width: '95%', maxWidth: '400px', margin: '15vh auto 0', background: 'rgba(10, 15, 30, 0.85)' }}>
          <h2 style={{ color: '#FFD700', marginBottom: '1.5rem', fontSize: '2.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>進入競技場</h2> 
          <input type="text" placeholder="房間代碼 (PIN)" value={pin} onChange={(e) => setPin(e.target.value)} className="game-input" disabled={!!searchParams.get('pin')} />
          <input type="text" placeholder="您的召喚師暱稱 (限8字)" value={username} maxLength={8} onChange={(e) => setUsername(e.target.value.slice(0, 8))} className="game-input" />
          <button className="btn-summon" onClick={handleJoinArena} style={{ background: 'linear-gradient(90deg, #f39c12, #e67e22)' }}>Ready!</button> 
        </div>
      )}

      {isJoined && !isPreparing && !currentQuestion && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel login-panel" style={{ width: '95%', maxWidth: '400px', margin: '15vh auto 0', textAlign: 'center' }}>
          <h2 style={{ color: '#FFD700', fontSize: '2.2rem', marginBottom: '1rem', textShadow: '0 0 10px rgba(241,196,15,0.8)' }}>房號: {pin}</h2>
          <p style={{ fontSize: '1.4rem', color: '#3498db', fontWeight: 'bold' }}>連線成功，等待主持人開始...</p> 
        </div>
      )}

      {/* 💡 修改點 2：在準備畫面中加入題型專屬的操作說明 */}
      {isJoined && isPreparing && prepareData && (
        <div className="game-panel question-transition" style={{ width: '95%', maxWidth: '600px', margin: '2vh auto 0', textAlign: 'center', padding: '2rem 1rem' }}>
           <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚔️</div>
           <h2 style={{ fontSize: '2rem', color: '#bdc3c7', marginBottom: '1.5rem', letterSpacing: '2px' }}>準備迎接挑戰</h2>
           <div style={{ fontSize: '3.5rem', fontWeight: '900', color: qTypeColors[prepareData.type] || '#fff', textShadow: '0 0 20px rgba(255,255,255,0.3)', marginBottom: '1rem' }}>{qTypeLabels[prepareData.type]}</div>
           
           {/* 操作提示文字區塊 */}
           <div style={{ background: 'rgba(0,0,0,0.5)', padding: '10px 15px', borderRadius: '10px', display: 'inline-block', marginBottom: '1.5rem', border: '1px solid rgba(241, 196, 15, 0.3)' }}>
             <p style={{ color: '#f1c40f', fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
               {qTypeInstructions[prepareData.type]}
             </p>
           </div>

           <div style={{ fontSize: '6rem', color: '#f1c40f', textShadow: '0 4px 10px rgba(0,0,0,0.5)', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>{prepareTimeLeft}</div>
        </div>
      )}

      {isJoined && currentQuestion && !isPreparing && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel question-transition" style={{ width: '95%', maxWidth: '600px', margin: '0 auto' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1c40f', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '15px', borderBottom: '2px solid rgba(255,215,0,0.3)', paddingBottom: '10px' }}>
            <span>👤 {username}</span><span>🏆 {myScore} 分 | 🏅 #{myRank}</span>
          </div>
          
          <div style={{ position: 'relative', width: '100%', height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid rgba(255,215,0,0.5)' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #f39c12, #f1c40f)', width: `${((currentQuestion?.currentQIndex || 1) / (currentQuestion?.totalQuestions || 1)) * 100}%`, transition: 'width 0.5s' }} />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '10px', marginBottom: '1rem', flexDirection: 'column' }}>
            <span style={{ background: qTypeColors[currentQuestion.type] || '#7f8c8d', color: '#fff', padding: '4px 12px', borderRadius: '8px', fontSize: '1.1rem', fontWeight: '900', alignSelf: 'flex-start' }}>{qTypeLabels[currentQuestion.type] || '未知'}</span>
            <h2 style={{ color: '#FFFFFF', fontSize: '1.8rem', margin: 0, textAlign: 'left', lineHeight: '1.4' }}>{currentQuestion?.text}</h2>
          </div>
          
          <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ height: '100%', background: timeLeft <= 5 ? '#e74c3c' : '#2ecc71', width: `${(timeLeft / (currentQuestion?.timeLimit || 15)) * 100}%`, transition: 'width 1s linear' }} />
          </div>

          {(currentQuestion?.type === 'guess' || currentQuestion?.type === 'img_choice') && !hasAnswered && (
             <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                <div style={{ width: '100%', maxWidth: '350px', height: '200px', borderRadius: '15px', overflow: 'hidden', border: '2px solid #f1c40f', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <img src={currentQuestion.guessImg} alt="q" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: currentQuestion.type === 'guess' ? 'cover' : 'contain', width: currentQuestion.type === 'guess' ? '100%' : 'auto', filter: currentQuestion.type === 'guess' && !hasAnswered ? `blur(${(timeLeft / currentQuestion.timeLimit) * 25}px) grayscale(${(timeLeft / currentQuestion.timeLimit) * 100}%)` : 'none', transition: currentQuestion.type === 'guess' ? 'filter 1s linear' : 'none' }} />
                </div>
             </div>
          )}

          {hasAnswered ? (
            <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)', padding: '2rem 1rem', borderRadius: '20px', border: '1px solid rgba(255,215,0,0.4)', animation: 'pulse 2s infinite', marginTop: '1rem', textAlign: 'center', boxShadow: '0 10px 2
