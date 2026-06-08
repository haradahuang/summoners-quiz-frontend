import React, { useState, useEffect, useRef } from 'react';
// 💡 修正打包錯誤：移除了會引發未定義錯誤的未使用引入 (如 topColors)
import { supabase, sfx, unlockAudio, qTypeLabels, qTypeColors, DEFAULT_TITLE, DEFAULT_BG } from '../config';
import { PageLayout, LeaderboardView } from '../components';

// 💡 集中管理各題型的作答提示 (大螢幕同步顯示)
const qTypeInstructions: Record<string, string> = {
  choice: '💡 準備好手速，點擊最快最正確的選項',
  img_choice: '💡 仔細看圖，選出正確答案',
  tf: '💡 判斷對錯，二選一',
  multi: '💡 點擊選取多個答案，完成後點擊下方送出',
  guess: '💡 圖片會隨時間變清晰，越快答對分數越高',
  order: '💡 由上而下排出正確順序，完成後點擊送出',
  match: '💡 請點擊相對應的圖片進行配對' // 💡 更新：文字已修正
};

export default function AdminApp() {
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [quizPacks, setQuizPacks] = useState<any[]>([]);
  const [editingPack, setEditingPack] = useState<any>(null); 
  
  const [hostingPin, setHostingPin] = useState<string | null>(null);
  const [hostingUrl, setHostingUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [roomTitle, setRoomTitle] = useState(DEFAULT_TITLE);
  const [roomBg, setRoomBg] = useState(DEFAULT_BG);
  
  const [isPreparing, setIsPreparing] = useState(false);
  const [prepareData, setPrepareData] = useState<any>(null);
  const [prepareTimeLeft, setPrepareTimeLeft] = useState(3);

  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [qType, setQType] = useState<'choice' | 'match' | 'tf' | 'multi' | 'guess' | 'order' | 'img_choice'>('choice');
  const [newQText, setNewQText] = useState('');
  const [newTime, setNewTime] = useState(10);
  const [newOptA, setNewOptA] = useState(''); const [newOptB, setNewOptB] = useState('');
  const [newOptC, setNewOptC] = useState(''); const [newOptD, setNewOptD] = useState('');
  const [newAns, setNewAns] = useState('A');
  const [newTfAns, setNewTfAns] = useState<'O' | 'X'>('O');
  const [newMultiAns, setNewMultiAns] = useState<string[]>([]);
  const [newGuessImg, setNewGuessImg] = useState<string>(''); 
  const [newAnswerImg, setNewAnswerImg] = useState<string>('');
  const [matchPairs, setMatchPairs] = useState([{ tName: '', tImg: '', bImg: '' }, { tName: '', tImg: '', bImg: '' }, { tName: '', tImg: '', bImg: '' }, { tName: '', tImg: '', bImg: '' }]);

  const playersMap = useRef(new Map<string, any>());
  const tickCount = useRef(0); 
  const [displayTags, setDisplayTags] = useState<string[]>([]); 
  const [dashboardStats, setDashboardStats] = useState({ total: 0, answered: 0 });

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0); 

  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [podiumData, setPodiumData] = useState<any[] | null>(null);

  const [channel, setChannel] = useState<any>(null);

  useEffect(() => {
    if (hostingPin && !podiumData) { sfx.victory.pause(); sfx.bgm.play().catch(()=>{}); }
    if (podiumData) { sfx.bgm.pause(); sfx.victory.currentTime = 0; sfx.victory.play().catch(()=>{}); sfx.cheer.currentTime = 0; sfx.cheer.play().catch(()=>{}); }
  }, [hostingPin, podiumData]);

  useEffect(() => {
    if (!hostingPin) return;
    const interval = setInterval(() => {
      let total = playersMap.current.size; let answered = 0;
      const allNames = Array.from(playersMap.current.keys());
      playersMap.current.forEach(p => { if (p.hasAnswered) answered++; });
      setDashboardStats({ total, answered });

      if (allNames.length <= 16) {
         setDisplayTags(allNames); 
      } else {
         tickCount.current++;
         if (tickCount.current % 4 === 0) { 
            setDisplayTags([...allNames].sort(() => 0.5 - Math.random()).slice(0, 16));
         }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [hostingPin]);

  useEffect(() => {
    let prepTimer: ReturnType<typeof setTimeout>;
    if (isPreparing && prepareTimeLeft > 0) {
       prepTimer = setTimeout(() => setPrepareTimeLeft(prepareTimeLeft - 1), 1000);
       sfx.tick.currentTime = 0; sfx.tick.play().catch(()=>{});
    } else if (isPreparing && prepareTimeLeft === 0) {
       setIsPreparing(false); sendNextQuestionActual(); 
    }
    return () => clearTimeout(prepTimer);
  }, [isPreparing, prepareTimeLeft]);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (currentQuestion && timeLeft > 0 && !leaderboard && !reviewData && !podiumData && !isPreparing) {
      timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000); 
    }
    return () => clearTimeout(timerId);
  }, [currentQuestion, timeLeft, leaderboard, reviewData, podiumData, isPreparing]);

  const fetchQuizzes = async (user: string) => {
    const { data, error } = await supabase.from('quiz_packs').select('*').eq('author', user);
    if (!error && data) {
      const mappedData = data.map(pack => ({ ...pack, backgroundImg: pack.background_img }));
      setQuizPacks(mappedData);
    }
  };

  const handleAuth = async () => {
    if(!username || !password) return alert('請填寫帳號密碼');
    setAdminUser(username); fetchQuizzes(username);
  };

  const handleHostGame = (pack: any) => {
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
    setHostingPin(generatedPin); setHostingUrl(`${window.location.origin}/?pin=${generatedPin}`);
    setRoomTitle(pack.title || DEFAULT_TITLE); setRoomBg(pack.backgroundImg || DEFAULT_BG);
    setEditingPack(pack); setCurrentQIndex(0); playersMap.current = new Map();

    const hostChannel = supabase.channel(`room_${generatedPin}`);
    hostChannel
      .on('presence', { event: 'sync' }, () => {
        const state = hostChannel.presenceState();
        Object.keys(state).forEach(key => {
           if (!playersMap.current.has(key)) {
              playersMap.current.set(key, { username: key, score: 0, hasAnswered: false, currentAnswer: null, responseTimeMs: 0 });
           }
        });
      })
      .on('broadcast', { event: 'player_joined' }, () => {
        hostChannel.send({ type: 'broadcast', event: 'room_info', payload: { title: pack.title, backgroundImg: pack.backgroundImg } });
      })
      .on('broadcast', { event: 'player_answered' }, ({ payload }) => {
        const p = playersMap.current.get(payload.username);
        if (p) {
           p.hasAnswered = true;
           p.currentAnswer = payload.answer;
           p.responseTimeMs = payload.responseTimeMs || 0; 
        }
      });

    hostChannel.subscribe(async (status) => { if (status === 'SUBSCRIBED') unlockAudio(); });
    setChannel(hostChannel);
  };

  const sendNextQuestion = () => {
    const nextIndex = currentQuestion ? currentQIndex + 1 : 0; setCurrentQIndex(nextIndex);
    if (!editingPack || !editingPack.questions || editingPack.questions.length <= nextIndex) return;
    const q = editingPack.questions[nextIndex];
    const prepPayload = { type: q.type, currentQIndex: nextIndex + 1, totalQuestions: editingPack.questions.length };

    setIsPreparing(true); setPrepareTimeLeft(3); setPrepareData(prepPayload);
    setLeaderboard(null); setReviewData(null); setPodiumData(null); setCurrentQuestion(null);
    playersMap.current.forEach(p => { p.hasAnswered = false; p.currentAnswer = null; p.responseTimeMs = 0; p.lastEarned = 0; });
    channel.send({ type: 'broadcast', event: 'prepare_question', payload: prepPayload });
  };

  const sendNextQuestionActual = () => {
    const q = editingPack.questions[currentQIndex];
    const qPayload = { ...q, currentQIndex: currentQIndex + 1, totalQuestions: editingPack.questions.length };
    setCurrentQuestion(qPayload); setTimeLeft(q.timeLimit || 15);
    channel.send({ type: 'broadcast', event: 'receive_question', payload: qPayload });
  };

  const showReviewAnswer = () => {
    const q = editingPack.questions[currentQIndex];
    const timeLimitMs = (q.timeLimit || 15) * 1000; 
    const stats: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, O: 0, X: 0 };
    
    playersMap.current.forEach(p => {
      if (!p.hasAnswered || p.currentAnswer === null) return;

      if (typeof p.currentAnswer === 'string') stats[p.currentAnswer] = (stats[p.currentAnswer] || 0) + 1;
      else if (Array.isArray(p.currentAnswer)) p.currentAnswer.forEach(ans => { stats[ans] = (stats[ans] || 0) + 1; });

      let isCorrect = false; let myAns = p.currentAnswer;
      if (['choice', 'tf', 'guess', 'img_choice'].includes(q.type)) isCorrect = myAns === q.correctAnswer;
      else if (q.type === 'multi') isCorrect = Array.isArray(myAns) && myAns.length === q.correctAnswers.length && myAns.every((v:any) => q.correctAnswers.includes(v));
      else if (q.type === 'order') isCorrect = myAns === q.correctAnswer;
      else if (q.type === 'match') isCorrect = JSON.stringify(myAns) === JSON.stringify(q.correctMatches);

      if (isCorrect) {
         const baseScore = 1000;
         const timeRatio = Math.min(1, Math.max(0, p.responseTimeMs / timeLimitMs));
         const speedBonus = Math.round((1 - timeRatio) * 1000);
         
         const totalEarned = baseScore + speedBonus;
         
         p.score += totalEarned;
         p.lastEarned = totalEarned;
      } else {
         p.lastEarned = 0;
      }
    });

    const hasNext = currentQIndex + 1 < (editingPack?.questions?.length || 0);
    const updatedPlayersArray = Array.from(playersMap.current.values());
    const reviewPayload = { question: currentQuestion, stats, hasNextQuestion: hasNext, players: updatedPlayersArray };
    
    setReviewData(reviewPayload); setLeaderboard(null); 
    channel.send({ type: 'broadcast', event: 'reveal_answer', payload: reviewPayload });
  };

  const showLeaderboard = () => {
    const sorted = Array.from(playersMap.current.values()).sort((a, b) => b.score - a.score);
    setLeaderboard(sorted);
    channel.send({ type: 'broadcast', event: 'leaderboard_updated', payload: sorted });
  };

  const showFinalPodium = () => {
    const top10 = Array.from(playersMap.current.values()).sort((a, b) => b.score - a.score).slice(0, 10);
    setPodiumData(top10); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null);
    channel.send({ type: 'broadcast', event: 'podium_updated', payload: top10 });
  };

  const handleDeletePack = async (packId: string) => {
    if (!window.confirm('確定要刪除這個題庫包嗎？')) return;
    const { error } = await supabase.from('quiz_packs').delete().eq('id', packId);
    if (!error) { fetchQuizzes(adminUser!); }
  };

  const handleCreateNewPack = () => { setEditingPack({ title: '未命名題庫包', author: adminUser, backgroundImg: '', questions: [] }); };
  
  const handleSavePack = async () => {
    if (!editingPack.title.trim()) return alert('請填寫名稱！');
    const payload = { title: editingPack.title, author: adminUser!, background_img: editingPack.backgroundImg, questions: editingPack.questions };
    let error;
    try {
      if (editingPack.id) { 
        const { error: err } = await supabase.from('quiz_packs').update(payload).eq('id', editingPack.id); 
        error = err; 
      } else { 
        const { error: err } = await supabase.from('quiz_packs').insert([payload]); 
        error = err; 
      }
    } catch (catchErr: any) { return alert(`❌ 網路錯誤：\n${catchErr.message}`); }
    
    if (!error) { 
      alert('💾 儲存成功！'); setEditingPack(null); fetchQuizzes(adminUser!); 
    } else { alert(`❌ 儲存失敗！\n【原因】：${error.message}`); }
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as 'choice' | 'match' | 'tf' | 'multi' | 'guess' | 'order' | 'img_choice';
    setQType(type);
    if (type === 'tf') setNewTime(5); else if (type === 'match' || type === 'order') setNewTime(30); else if (type === 'guess') setNewTime(12); else if (type === 'img_choice') setNewTime(15); else setNewTime(10);
  };

  const handleEditQuestion = (q: any) => {
    setEditingQuestionId(q.id); setQType(q.type); setNewQText(q.text); setNewTime(q.timeLimit);
    if (q.type === 'choice' || q.type === 'multi' || q.type === 'guess' || q.type === 'order' || q.type === 'img_choice') {
      setNewOptA(q.options[0]?.text || ''); setNewOptB(q.options[1]?.text || ''); setNewOptC(q.options[2]?.text || ''); setNewOptD(q.options[3]?.text || '');
      if (q.type === 'choice' || q.type === 'guess' || q.type === 'img_choice') setNewAns(q.correctAnswer || 'A');
      if (q.type === 'multi') setNewMultiAns(q.correctAnswers || []);
      if (q.type === 'guess' || q.type === 'img_choice') { setNewGuessImg(q.guessImg || ''); if (q.type === 'img_choice') setNewAnswerImg(q.answerImg || ''); }
    } else if (q.type === 'tf') { setNewTfAns(q.correctAnswer || 'O'); } else if (q.type === 'match') {
      const pairs = [{ tName: '', tImg: '', bImg: '' }, { tName: '', tImg: '', bImg: '' }, { tName: '', tImg: '', bImg: '' }, { tName: '', tImg: '', bImg: '' }];
      q.topItems?.forEach((t: any, i: number) => { pairs[i].tName = t.name; pairs[i].tImg = t.img; pairs[i].bImg = q.bottomItems?.find((b:any) => b.id === q.correctMatches[t.id])?.img || ''; });
      setMatchPairs(pairs);
    }
    setTimeout(() => { document.getElementById('question-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
  };

  const handleCancelEditQuestion = () => {
    setEditingQuestionId(null); setQType('choice'); setNewTime(10); setNewQText('');
    setNewOptA(''); setNewOptB(''); setNewOptC(''); setNewOptD(''); setNewAns('A');
    setNewTfAns('O'); setNewMultiAns([]); setNewGuessImg(''); setNewAnswerImg('');
    setMatchPairs([{ tName:'', tImg:'', bImg:'' }, { tName:'', tImg:'', bImg:'' }, { tName:'', tImg:'', bImg:'' }, { tName:'', tImg:'', bImg:'' }]);
  };

  const handleSaveQuestion = () => {
    if (!newQText.trim()) return alert('請填寫題目敘述文字！');
    let newQ: any = { id: editingQuestionId || Date.now(), type: qType, text: newQText, timeLimit: newTime };
    if (qType === 'choice' || qType === 'multi' || qType === 'guess' || qType === 'order' || qType === 'img_choice') {
      if (!newOptA.trim() || !newOptB.trim() || !newOptC.trim() || !newOptD.trim()) return alert('此題型強烈建議填寫 A/B/C/D 四個完整選項！');
      if ((qType === 'guess' || qType === 'img_choice') && !newGuessImg) return alert('請上傳題目圖片！');
      if (qType === 'img_choice' && !newAnswerImg) return alert('請上傳解答圖片！'); 
      const options = [];
      if (newOptA.trim()) options.push({ id: 'A', text: newOptA, color: '#e53e3e' });
      if (newOptB.trim()) options.push({ id: 'B', text: newOptB, color: '#3182ce' });
      if (newOptC.trim()) options.push({ id: 'C', text: newOptC, color: '#d69e2e' });
      if (newOptD.trim()) options.push({ id: 'D', text: newOptD, color: '#805ad5' });
      newQ.options = options;
      if (qType === 'choice' || qType === 'guess' || qType === 'img_choice') {
        if (!options.find(o => o.id === newAns)) return alert(`您設定的正解不存在！`);
        newQ.correctAnswer = newAns;
        if (qType === 'guess' || qType === 'img_choice') { newQ.guessImg = newGuessImg; if (qType === 'img_choice') newQ.answerImg = newAnswerImg; }
      } else if (qType === 'multi') {
        if (newMultiAns.length === 0) return alert('多選題請至少勾選一個正確解答！');
        newQ.correctAnswers = newMultiAns;
      } else if (qType === 'order') { newQ.correctAnswer = options.map(o => o.id).join(','); }
    } else if (qType === 'tf') { newQ.correctAnswer = newTfAns; } else {
      if (!matchPairs.every(p => p.tName && p.tImg && p.bImg)) return alert('請確保 4 組配對資料完整！');
      newQ.topItems = matchPairs.map((p, i) => ({ id: `T${i+1}`, name: p.tName, img: p.tImg }));
      newQ.bottomItems = matchPairs.map((p, i) => ({ id: `B${i+1}`, img: p.bImg }));
      newQ.correctMatches = { 'T1':'B1', 'T2':'B2', 'T3':'B3', 'T4':'B4' };
    }
    if (editingQuestionId) setEditingPack({ ...editingPack, questions: editingPack.questions.map((q: any) => q.id === editingQuestionId ? newQ : q) });
    else setEditingPack({ ...editingPack, questions: [...editingPack.questions, newQ] });
    handleCancelEditQuestion();
  };

  const handleDeleteQuestion = (idToRemove: number) => { setEditingPack({ ...editingPack, questions: editingPack.questions.filter((q: any) => q.id !== idToRemove) }); };

  const handleReturnToDashboard = () => {
    if (channel) channel.unsubscribe();
    sfx.victory.pause(); sfx.victory.currentTime = 0; sfx.cheer.pause(); sfx.cheer.currentTime = 0; sfx.bgm.pause(); sfx.bgm.currentTime = 0;
    setHostingPin(null); 
    setHostingUrl(null); 
    playersMap.current.clear(); 
    setCurrentQuestion(null); 
    setLeaderboard(null); 
    setReviewData(null); 
    setPodiumData(null);
    setEditingPack(null); 
    setRoomTitle(DEFAULT_TITLE); 
    setRoomBg(DEFAULT_BG); 
    fetchQuizzes(adminUser!);
  };

  let displayTitle = '創作者儀表板'; let displayBg = DEFAULT_BG;
  if (hostingPin) { displayTitle = roomTitle; displayBg = roomBg; }
  else if (editingPack) { displayTitle = editingPack.title || '編輯題庫包'; displayBg = editingPack.backgroundImg || DEFAULT_BG; }

  if (!adminUser) return (
    <PageLayout title="" bgImg={DEFAULT_BG}>
      <div className="game-panel login-panel" style={{ maxWidth: '400px', margin: '20vh auto 0', background: 'rgba(10, 20, 40, 0.85)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
        <h2 style={{ color: '#FFD700', marginBottom: '1.5rem', textAlign: 'center', fontSize: '1.5rem' }}>🔐 創作者登入</h2>
        <input type="text" placeholder="請輸入帳號" value={username} onChange={(e) => setUsername(e.target.value)} className="game-input" style={{ textAlign: 'center' }} />
        <input type="password" placeholder="請輸入密碼" value={password} onChange={(e) => setPassword(e.target.value)} className="game-input" style={{ textAlign: 'center' }} />
        <button className="btn-summon" onClick={handleAuth} style={{ marginTop: '10px', background: 'linear-gradient(90deg, #f39c12, #e67e22)' }}>進入系統</button>
      </div>
    </PageLayout>
  );

  if (hostingPin) {
    const isGameStarted = currentQuestion || leaderboard || reviewData || podiumData || isPreparing;
    return (
      <PageLayout title={displayTitle} bgImg={displayBg}>
        <div className="game-panel admin-mega-panel" style={{ margin: '0 auto', paddingBottom: '1.5rem', background: 'rgba(15, 20, 35, 0.92)', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
          {!isGameStarted ? (
            <div style={{ padding: '2vh 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginBottom: '1vh' }}>
                 <h2 style={{ color: '#e74c3c', fontSize: '2.5rem', margin: 0 }}>👑 主持人控場中心</h2>
              </div>
              <h3 style={{ color: '#f1c40f', fontSize: '4.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)', margin: '1vh 0' }}>房號: {hostingPin}</h3>
              
              <div style={{ margin: '2vh 0' }}>
                <button className="btn-copy" onClick={() => {
                   if(hostingUrl) {
                      navigator.clipboard.writeText(hostingUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                   }
                }}>
                   {copied ? '✅ 連結已複製！' : '🔗 點擊複製遊戲連結'}
                </button>
              </div>
              
              <div style={{ background: '#fff', padding: '10px', borderRadius: '10px', display: 'inline-block', margin: '1vh 0' }}>
                 <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(hostingUrl || '')}`} alt="Game QR Code" style={{ width: '150px', height: '150px', display: 'block' }} />
              </div>

              <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '1vh 0' }}>目前進場: <span style={{ color: '#f1c40f', fontSize: '2.5rem' }}>{dashboardStats.total}</span> 人</p>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', margin: '3vh 0', minHeight: '80px', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '15px' }}>
                {displayTags.map((pName, i) => <span key={i} style={{ background: 'rgba(255,215,0,0.15)', padding: '8px 15px', borderRadius: '8px', fontSize: '1.2rem', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)', transition: 'all 0.5s ease', animation: 'bounceIn 0.3s' }}>{pName}</span>)}
                {dashboardStats.total > 16 && <span style={{ background: 'rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '8px', fontSize: '1.2rem', color: '#bdc3c7', fontStyle: 'italic' }}>...及其他 {dashboardStats.total - 16} 名召喚師</span>}
              </div>
              
              <button className="btn-summon" onClick={sendNextQuestion} style={{ fontSize: '2rem', padding: '15px 60px', background: 'linear-gradient(90deg, #2ecc71, #27ae60)' }}>▶️ 正式開始遊戲</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#bdc3c7', fontSize: '1.2rem', marginBottom: '1.5vh', borderBottom: '2px solid #444', paddingBottom: '10px' }}>
                <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>👑 主持人大螢幕模式</span>
                <span>房間: <strong style={{color:'#fff'}}>{hostingPin}</strong> | 總進場: <strong style={{color:'#fff'}}>{dashboardStats.total}</strong> 人</span>
              </div>

              {isPreparing && prepareData && (
                <div className="question-transition" style={{ padding: '5vh 0' }}>
                   <h2 style={{ fontSize: '3.5rem', color: '#bdc3c7', marginBottom: '3vh', letterSpacing: '3px' }}>⚔️ 準備迎接挑戰</h2>
                   <div style={{ fontSize: '5.5rem', fontWeight: '900', color: qTypeColors[prepareData.type] || '#fff', textShadow: '0 0 25px rgba(255,255,255,0.4)', marginBottom: '3vh' }}>
                     {qTypeLabels[prepareData.type]}
                   </div>
                   
                   <div style={{ background: 'rgba(0,0,0,0.5)', padding: '15px 30px', borderRadius: '15px', display: 'inline-block', marginBottom: '3vh', border: '2px solid rgba(241, 196, 15, 0.4)' }}>
                     <p style={{ color: '#f1c40f', fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>
                       {qTypeInstructions[prepareData.type]}
                     </p>
                   </div>

                   <div style={{ fontSize: '8rem', color: '#f1c40f', textShadow: '0 5px 15px rgba(0,0,0,0.6)', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>
                     {prepareTimeLeft}
                   </div>
                </div>
              )}

              {/* 💡 修正打包錯誤：還原靜態的大螢幕題目顯示區塊，徹底拔除玩家點擊邏輯 */}
              {currentQuestion && !reviewData && !leaderboard && !podiumData && !isPreparing && (
                <div className="question-transition">
                  <div style={{ position: 'relative', width: '100%', height: '28px', background: 'rgba(255,255,255,0.1)', borderRadius: '14px', overflow: 'hidden', marginBottom: '1.5vh', border: '1px solid rgba(255,215,0,0.5)' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, #f39c12, #f1c40f)', width: `${((currentQuestion?.currentQIndex || 1) / (currentQuestion?.totalQuestions || 1)) * 100}%`, transition: 'width 0.5s' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontWeight: '900', fontSize: '1.2rem', textShadow: '1px 1px 2px #000' }}>
                      題目進度: {currentQuestion?.currentQIndex || 1} / {currentQuestion?.totalQuestions || 1}
                    </div>
                  </div>

                  <h3 style={{ color: '#34db98', marginBottom: '1.5vh', fontSize: '1.8rem', margin: '1vh 0' }}>
                    ⏳ 題目作答中... 倒數 <span style={{color: '#f1c40f', fontSize: '2.4rem', fontWeight: '900'}}>{timeLeft}</span> 秒 (已答題: <span style={{color:'#fff'}}>{dashboardStats.answered} / {dashboardStats.total}</span> 人)
                  </h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '2vh', flexWrap: 'wrap' }}>
                    <span style={{ background: qTypeColors[currentQuestion.type] || '#7f8c8d', color: '#fff', padding: '8px 20px', borderRadius: '10px', fontSize: '1.6rem', fontWeight: '900', boxShadow: '0 4px 8px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
                      {qTypeLabels[currentQuestion.type] || '未知'}
                    </span>
                    <h2 style={{ color: '#FFF', fontSize: '2.4rem', margin: 0, textAlign: 'left', lineHeight: '1.3' }}>{currentQuestion.text}</h2>
                  </div>
                  
                  {(currentQuestion.type === 'guess' || currentQuestion.type === 'img_choice') && (
                     <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5vh' }}>
                        <div style={{ width: '100%', maxWidth: '600px', height: '35vh', minHeight: '200px', borderRadius: '20px', overflow: 'hidden', border: '4px solid #f1c40f', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 20px rgba(0,0,0,0.5)' }}>
                           <img src={currentQuestion.guessImg} alt="question" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: currentQuestion.type === 'guess' ? 'cover' : 'contain', width: currentQuestion.type === 'guess' ? '100%' : 'auto', filter: currentQuestion.type === 'guess' ? `blur(${(timeLeft / currentQuestion.timeLimit) * 25}px) grayscale(${(timeLeft / currentQuestion.timeLimit) * 100}%)` : 'none', transition: currentQuestion.type === 'guess' ? 'filter 1s linear' : 'none' }} />
                        </div>
                     </div>
                  )}

                  {(currentQuestion.type === 'choice' || currentQuestion.type === 'multi' || currentQuestion.type === 'guess' || currentQuestion.type === 'order' || currentQuestion.type === 'img_choice') && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', opacity: 0.95 }}>
                      {currentQuestion.options?.map((opt: any) => (<div key={opt.id} style={{ padding: '20px', fontSize: '1.6rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', borderLeft: `10px solid ${opt.color}`, color: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', transition: 'transform 0.2s' }}>{opt.text}</div>))}
                    </div>
                  )}
                  {currentQuestion.type === 'tf' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', opacity: 0.95 }}>
                      <div style={{ padding: '25px', background: 'linear-gradient(145deg, #00e673, #00b359)', borderRadius: '15px', color: '#ffffff', textAlign:'center', fontSize:'4.5rem', fontFamily: 'Arial, sans-serif', fontWeight: '900', boxShadow: '0 8px 0 #008040, 0 10px 15px rgba(0,0,0,0.4)', textShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>O</div>
                      <div style={{ padding: '25px', background: 'linear-gradient(145deg, #ff4d4d, #e60000)', borderRadius: '15px', color: '#ffffff', textAlign:'center', fontSize:'4.5rem', fontFamily: 'Arial, sans-serif', fontWeight: '900', boxShadow: '0 8px 0 #b30000, 0 10px 15px rgba(0,0,0,0.4)', textShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>X</div>
                    </div>
                  )}
                  <button className="btn-summon" onClick={showReviewAnswer} style={{ background: 'linear-gradient(90deg, #34495e, #2c3e50)', marginTop: '3vh', fontSize: '1.4rem', padding: '15px' }}>🔍 揭曉正確答案</button>
                </div>
              )}
              
              {reviewData && !leaderboard && !podiumData && !isPreparing && (
                <div>
                  <h2 style={{ color: '#3498db', fontSize: '2.4rem', marginBottom: '1.5vh', textShadow: '0 0 15px rgba(52, 152, 219, 0.5)' }}>正確答案</h2>

                  {(reviewData.question.type === 'guess' || reviewData.question.type === 'img_choice') && (
                     <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5vh' }}>
                        <div style={{ width: reviewData.question.type === 'img_choice' ? '100%' : '250px', maxWidth: '500px', height: '35vh', minHeight: '200px', borderRadius: '20px', overflow: 'hidden', border: '5px solid #2ecc71', boxShadow: '0 0 25px rgba(46, 204, 113, 0.6)', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <img src={reviewData.question.type === 'img_choice' ? (reviewData.question.answerImg || reviewData.question.guessImg) : reviewData.question.guessImg} alt="answer clear" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: reviewData.question.type === 'guess' ? 'cover' : 'contain' }} />
                        </div>
                     </div>
                  )}

                  {(reviewData.question.type === 'choice' || reviewData.question.type === 'multi' || reviewData.question.type === 'guess' || reviewData.question.type === 'img_choice') && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                       {reviewData.question.options.map((opt: any) => {
                         const isC = reviewData.question.type === 'multi' ? reviewData.question.correctAnswers.includes(opt.id) : opt.id === reviewData.question.correctAnswer;
                         return (<div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1.5rem', background: isC ? 'rgba(46, 204, 113, 0.25)' : 'rgba(255,255,255,0.05)', border: isC ? '3px solid #2ecc71' : '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '1.5rem', fontWeight: 'bold' }}><span style={{ color: isC ? '#2ecc71' : '#fff' }}>{isC && '✔️ '} {opt.text}</span><span style={{ color: '#bdc3c7' }}>{reviewData.stats[opt.id] || 0} 人</span></div>);
                       })}
                     </div>
                  )}

                  {reviewData.question.type === 'order' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <p style={{ color: '#2ecc71', fontSize: '1.6rem', marginBottom: '1vh', fontWeight: 'bold', textAlign: 'center' }}>🎯 正確排序</p>
                      {(reviewData.question.options || []).map((opt: any, idx: number) => (
                        <div key={opt.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(46, 204, 113, 0.15)', padding: '15px', borderRadius: '12px', border: '2px solid #2ecc71' }}>
                           <span style={{ color: '#2ecc71', fontWeight: '900', marginRight: '20px', fontSize: '1.8rem', width: '35px' }}>{idx + 1}.</span>
                           <span style={{ color: '#fff', flex: 1, fontSize: '1.5rem', textAlign: 'left', fontWeight: 'bold' }}>{opt.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {reviewData.question.type === 'tf' && (
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '180px', height: '180px', fontSize: '6rem', fontFamily: 'Arial, sans-serif', fontWeight: '900', color: '#ffffff', background: reviewData.question.correctAnswer === 'O' ? 'linear-gradient(145deg, #00e673, #00b359)' : 'linear-gradient(145deg, #ff4d4d, #e60000)', borderRadius: '30px', boxShadow: reviewData.question.correctAnswer === 'O' ? '0 12px 0 #008040' : '0 12px 0 #b30000', margin: '2vh auto' }}>
                          {reviewData.question.correctAnswer}
                        </div>
                     </div>
                  )}
                  <button className="btn-summon" onClick={showLeaderboard} style={{ background: 'linear-gradient(90deg, #9b59b6, #8e44ad)', marginTop: '3vh', fontSize: '1.4rem', padding: '15px' }}>📊 結算當前排名</button>
                </div>
              )}

              {leaderboard && !podiumData && !isPreparing && (
                <div>
                  <h2 style={{ color: '#FFD700', fontSize: '2.5rem', marginBottom: '2vh', textShadow: '0 0 15px rgba(241,196,15,0.5)' }}>🏆 排名結算 (Top 5)</h2>
                  <LeaderboardView data={leaderboard} />
                  {reviewData?.hasNextQuestion ? (
                    <button className="btn-summon" onClick={sendNextQuestion} style={{ background: 'linear-gradient(90deg, #2ecc71, #27ae60)', marginTop: '3vh', fontSize: '1.5rem', padding: '15px' }}>▶️ 下一題</button>
                  ) : (
                    <button className="btn-summon" onClick={showFinalPodium} style={{ background: 'linear-gradient(90deg, #f1c40f, #f39c12)', marginTop: '3vh', fontSize: '1.5rem', padding: '15px' }}>🏆 揭曉最終榮耀</button>
                  )}
                </div>
              )}

              {podiumData && (
                <div style={{ animation: 'bounceIn 1s ease', position: 'relative' }}>
                  <div className="firework fw-1">🎆</div><div className="firework fw-2">🎇</div>
                  <div className="podium-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <h2 style={{ color: '#FFD700', fontSize: '4rem', marginBottom: '2vh', textShadow: '0 0 20px rgba(255,215,0,0.8)' }}>🏆 傳奇誕生 🏆</h2>
                    {podiumData.map((p, idx) => {
                      if (idx === 0) {
                        return (
                          <h3 key={p.username} style={{color: '#f1c40f', fontSize: '3.5rem', textShadow: '0 4px 8px rgba(0,0,0,0.8)', margin: '1.5vh 0'}}>
                            🥇 {p.username} <span style={{fontSize:'1.8rem'}}>({p.score}分)</span>
                          </h3>
                        );
                      }
                      const icons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
                      const color = idx === 1 ? '#bdc3c7' : idx === 2 ? '#e67e22' : '#ecf0f1';
                      return (
                        <h4 key={p.username} style={{color, fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)', margin: '0.8vh 0', fontWeight: 'bold'}}>
                          {icons[idx]} {p.username} <span style={{fontSize:'1.2rem'}}>({p.score}分)</span>
                        </h4>
                      );
                    })}
                  </div>
                  <button className="btn-summon" onClick={handleReturnToDashboard} style={{ background: 'linear-gradient(90deg, #3498db, #2980b9)', marginTop: '4vh', position: 'relative', zIndex: 10, fontSize: '1.5rem', padding: '15px 30px' }}>🏠 結束並返回大廳</button>
                </div>
              )}
            </>
          )}
        </div>
      </PageLayout>
    );
  }

  if (editingPack) {
    return (
      <PageLayout title={displayTitle} bgImg={displayBg}>
        <div className="game-panel admin-mega-panel" style={{ margin: '0 auto', paddingBottom: '3rem', background: 'rgba(15, 20, 35, 0.95)', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
            <h2 style={{ color: '#FFD700', margin: 0 }}>✏️ 題庫編輯器</h2>
            <button onClick={() => { setEditingPack(null); handleCancelEditQuestion(); }} style={{ padding: '0.6rem 1.2rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>返回列表</button>
          </div>
          <input type="text" value={editingPack.title} onChange={(e) => setEditingPack({...editingPack, title: e.target.value})} placeholder="題庫包名稱" className="game-input" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f1c40f', background: 'rgba(0,0,0,0.5)' }} />

          <div style={{ marginBottom: '20px' }}>
            <p style={{ color: '#3498db', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 'bold' }}>* 選擇自訂遊戲背景圖</p>
            <label style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.4)', border: '2px dashed #3498db', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', overflow: 'hidden' }}>
              {editingPack.backgroundImg ? <img src={editingPack.backgroundImg} alt="bg" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} /> : <span style={{fontSize: '1.1rem', color: '#3498db', fontWeight: 'bold'}}>+ 點擊上傳背景圖</span>}
              <input type="file" accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files?.[0]; if (!file) return;
                if (file.size > 1024 * 1024) return alert('背景圖太大！');
                const reader = new FileReader(); reader.onload = (ev) => setEditingPack({ ...editingPack, backgroundImg: ev.target?.result as string }); reader.readAsDataURL(file);
              }} />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
            {(editingPack.questions || []).map((q: any, idx: number) => (
              <div key={q.id} style={{ background: 'rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `6px solid ${qTypeColors[q.type] || '#7f8c8d'}` }}>
                <div style={{ flex: 1, paddingRight: '15px' }}>
                  <span style={{ background: qTypeColors[q.type], padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', marginRight: '10px', color: '#fff', fontWeight: 'bold' }}>{qTypeLabels[q.type]}</span>
                  <strong style={{ fontSize: '1.1rem', color: '#fff' }}>Q{idx + 1}. {q.text}</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEditQuestion(q)} style={{ background: 'linear-gradient(90deg, #f39c12, #e67e22)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px' }}>修改</button>
                  <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'linear-gradient(90deg, #e74c3c, #c0392b)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px' }}>刪除</button>
                </div>
              </div>
            ))}
          </div>

          <div id="question-edit-form" style={{ background: editingQuestionId ? 'rgba(243, 156, 18, 0.15)' : 'rgba(0,0,0,0.6)', padding: '2rem', borderRadius: '15px', marginTop: '2.5rem', border: editingQuestionId ? '2px solid #f39c12' : '1px dashed #7f8c8d' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <h3 style={{ color: editingQuestionId ? '#f39c12' : '#2ecc71', margin: 0 }}>{editingQuestionId ? '✏️ 修改當前題目' : '➕ 新增一題'}</h3>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <select value={qType} onChange={handleTypeChange} className="game-input" style={{ flex: 1 }}><option value="choice">單選題</option><option value="img_choice">看圖單選題</option><option value="tf">是非題 (O/X)</option><option value="multi">多選題</option><option value="guess">漸進猜圖題</option><option value="order">排序題</option><option value="match">圖片配對題</option></select>
              <input type="number" placeholder="秒數" value={newTime} onChange={(e) => setNewTime(Number(e.target.value))} className="game-input" style={{ width: '120px' }} />
            </div>
            <input type="text" placeholder="請輸入完整題目敘述文字" value={newQText} onChange={(e) => setNewQText(e.target.value)} className="game-input" />
            <button className="btn-summon" onClick={handleSaveQuestion} style={{ marginTop: '25px', background: 'linear-gradient(90deg, #3498db, #2980b9)' }}>➕ 加入題庫</button>
          </div>
          <button className="btn-summon" onClick={handleSavePack} style={{ marginTop: '30px', background: 'linear-gradient(90deg, #2ecc71, #27ae60)' }}>💾 完成！儲存整包題庫</button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={displayTitle} bgImg={displayBg}>
      <div className="game-panel login-panel admin-mega-panel" style={{ margin: '0 auto', background: 'rgba(15, 20, 35, 0.9)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', alignItems: 'center' }}>
          <h2 style={{ color: '#FFD700', margin: 0, fontSize: '2rem' }}>📚 創作者儀表板</h2>
          <button onClick={() => setAdminUser(null)} style={{ padding: '0.6rem 1.2rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '8px' }}>登出系統</button>
        </div>
        <button className="btn-summon" onClick={handleCreateNewPack} style={{ background: 'linear-gradient(90deg, #2ecc71, #27ae60)', marginBottom: '25px' }}>➕ 建立全新題庫</button>
        <div style={{ display: 'grid', gap: '20px' }}>
          {quizPacks.map(pack => (
            <div key={pack.id} style={{ background: 'rgba(255,255,255,0.08)', padding: '20px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '8px solid #3498db' }}>
              <div><h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '8px' }}>{pack.title}</h3><p style={{ color: '#bdc3c7', fontWeight: 'bold' }}>包含 {pack.questions?.length || 0} 道題目</p></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-summon" onClick={() => { setEditingPack(pack); setEditingQuestionId(null); }} style={{ padding: '10px 20px', background: 'linear-gradient(90deg, #3498db, #2980b9)' }}>編輯</button>
                <button className="btn-summon" onClick={() => handleDeletePack(pack.id)} style={{ padding: '10px 20px', background: 'linear-gradient(90deg, #e74c3c, #c0392b)' }}>🗑️ 刪除</button>
                <button className="btn-summon" onClick={() => handleHostGame(pack)} style={{ padding: '10px 30px', background: 'linear-gradient(90deg, #f39c12, #e67e22)', fontSize: '1.2rem' }}>🚀 啟動遊戲</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
