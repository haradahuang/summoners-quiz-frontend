import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useSearchParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import './index.css';

// 🌐 Supabase 憑證設定
const RAW_SUPABASE_URL = 'https://kxungtkticxfnqmbdzlq.supabase.co/rest/v1/'; // 貼這裡
const SUPABASE_ANON_KEY = 'sb_publishable_1J5xq2_aA5M1TJNk3CADAw_sFIuJ5Q7'; // 貼這裡

const CLEAN_SUPABASE_URL = RAW_SUPABASE_URL.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(CLEAN_SUPABASE_URL, SUPABASE_ANON_KEY);

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
Object.values(sfx).forEach(audio => { audio.preload = 'auto'; }); sfx.bgm.loop = true; sfx.victory.loop = true;
const unlockAudio = () => {
  const originalVolumes: Record<string, number> = { bgm: 0.3, tick: 0.6, correct: 0.8, wrong: 0.8, victory: 0.5, cheer: 0.8 };
  Object.keys(sfx).forEach(key => {
    const audio = sfx[key]; audio.volume = 0.01; 
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.volume = originalVolumes[key]; }).catch(() => {});
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
const qTypeLabels: Record<string, string> = { choice: '單選題', match: '圖片配對題', tf: '是非題', multi: '多選題', guess: '漸進猜圖題', order: '順序排列題', img_choice: '看圖單選題' };
const qTypeColors: Record<string, string> = { choice: '#3498db', match: '#9b59b6', tf: '#e67e22', multi: '#2ecc71', guess: '#e84393', order: '#f39c12', img_choice: '#1abc9c' };

const DEFAULT_TITLE = '瞬答 FlashQuiz';
const DEFAULT_BG = '/flashquiz.jpg';

// ==========================================
// 🎨 全域大佈局組件
// ==========================================
const PageLayout = ({ title, bgImg, children }: { title?: string, bgImg?: string, children: React.ReactNode }) => {
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
const LeaderboardView = ({ data }: { data: any[] }) => {
  const [displayRanks, setDisplayRanks] = useState(() => {
    return data.map((player) => {
      const oldIndex = globalLastLeaderboard.findIndex(p => p.username === player.username);
      return { ...player, currentIdx: oldIndex !== -1 ? oldIndex : data.length, opacity: oldIndex !== -1 ? 1 : 0 };
    });
  });

  useEffect(() => {
    const timer = setTimeout(() => { setDisplayRanks(data.map((player, idx) => ({ ...player, currentIdx: idx, opacity: 1 }))); globalLastLeaderboard = data; }, 50);
    return () => clearTimeout(timer);
  }, [data]);

  return (
    <div style={{ position: 'relative', height: `${data.length * 60}px`, transition: 'height 0.3s', marginBottom: '10px' }}>
      {displayRanks.map((player) => {
        const idx = player.currentIdx; const finalIdx = data.findIndex(p => p.username === player.username); 
        const isTop3 = finalIdx < 3; const rankColors = ['#FFD700', '#bdc3c7', '#e67e22']; const rankColor = isTop3 ? rankColors[finalIdx] : '#444';
        const fontSize = finalIdx === 0 ? '1.4rem' : finalIdx === 1 ? '1.2rem' : finalIdx === 2 ? '1.1rem' : '1rem';
        return (
          <div key={player.username} style={{ position: 'absolute', top: `${idx * 60}px`, left: 0, width: '100%', height: '50px', opacity: player.opacity, transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 1.5rem', background: 'rgba(20, 30, 48, 0.8)', backdropFilter: 'blur(10px)', borderRadius: '10px', borderLeft: `6px solid ${rankColor}`, boxShadow: '0 4px 15px rgba(0,0,0,0.5)', zIndex: 20 - finalIdx }}>
            <span title={player.username} style={{ color: isTop3 ? rankColor : '#FFF', fontSize, fontWeight: isTop3 ? '900' : 'bold', transition: 'all 0.5s', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left', paddingRight: '10px' }}>#{finalIdx + 1} {player.username}</span>
            <span style={{ color: isTop3 ? rankColor : '#FFD700', fontSize, fontWeight: isTop3 ? '900' : 'bold', transition: 'all 0.5s', flexShrink: 0, textShadow: '1px 1px 2px #000' }}>{player.score} 分</span>
          </div>
        );
      })}
    </div>
  );
};

// ==========================================
// 🎮 玩家端介面
// ==========================================
function PlayerApp() {
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [username, setUsername] = useState('');
  const [isJoined, setIsJoined] = useState(false);
  const [players, setPlayers] = useState<any[]>([]);
  
  const [roomTitle, setRoomTitle] = useState(DEFAULT_TITLE);
  const [roomBg, setRoomBg] = useState(searchParams.get('pin') ? 'LOADING' : DEFAULT_BG);

  // 💡 新增：準備階段狀態
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

  // 💡 修正 BUG 2：儲存單選/是非題的玩家答案
  const [singleSelected, setSingleSelected] = useState<string>('');
  const [activeTopId, setActiveTopId] = useState<string | null>(null);
  const [userMatches, setUserMatches] = useState<Record<string, string>>({});
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [orderState, setOrderState] = useState<any[]>([]); 

  const [channel, setChannel] = useState<any>(null);
  const [myScore, setMyScore] = useState(0);

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

    const quizRoom = supabase.channel(`room_${pin}`, {
      config: { presence: { key: username } }
    });

    quizRoom
      .on('presence', { event: 'sync' }, () => {
        const state = quizRoom.presenceState();
        const list = Object.keys(state).map(key => ({
          username: key,
          score: state[key][0]?.score || 0,
          hasAnswered: state[key][0]?.hasAnswered || false
        }));
        setPlayers(list);
      })
      .on('broadcast', { event: 'room_info' }, ({ payload }) => {
        setRoomTitle(payload.title || DEFAULT_TITLE);
        setRoomBg(payload.backgroundImg || DEFAULT_BG);
      })
      // 💡 新增廣播：準備階段
      .on('broadcast', { event: 'prepare_question' }, ({ payload }) => {
        setIsPreparing(true); setPrepareData(payload); setPrepareTimeLeft(3);
        setAnswerResult(null); setLeaderboard(null); setReviewData(null); setPodiumData(null); setCurrentQuestion(null);
        // 清空所有上一題的答題紀錄
        setSingleSelected(''); setUserMatches({}); setActiveTopId(null); setMultiSelected([]); setOrderState([]); setHasAnswered(false);
        quizRoom.track({ score: myScore, hasAnswered: false });
      })
      .on('broadcast', { event: 'receive_question' }, ({ payload }) => {
        setIsPreparing(false); // 關閉準備畫面
        const q = payload;
        if (q.type === 'match' && q.bottomItems) q.bottomItems = q.bottomItems.sort(() => Math.random() - 0.5);
        if (q.type === 'order' && q.options) setOrderState([...q.options].sort(() => Math.random() - 0.5));
        setCurrentQuestion(q); setTimeLeft(q?.timeLimit || 15); setHasAnswered(false); 
      })
      .on('broadcast', { event: 'reveal_answer' }, ({ payload }) => {
        const q = payload.question;
        const stats = payload.stats || {};
        let isCorrect = false;

        let myAns: any = '';
        if (currentQuestion?.type === 'match') myAns = userMatches;
        else if (currentQuestion?.type === 'multi') myAns = multiSelected;
        else if (currentQuestion?.type === 'order') myAns = orderState.map(o => o.id).join(',');
        else myAns = singleSelected; // 💡 修正 BUG 2：將玩家單選的答案取出比對！

        if (['choice', 'tf', 'guess', 'img_choice'].includes(q.type)) {
          isCorrect = myAns === q.correctAnswer;
        } else if (q.type === 'multi') {
          isCorrect = Array.isArray(myAns) && myAns.length === q.correctAnswers.length && myAns.every(v => q.correctAnswers.includes(v));
        } else if (q.type === 'order') {
          isCorrect = myAns === q.correctAnswer;
        } else if (q.type === 'match') {
          isCorrect = JSON.stringify(myAns) === JSON.stringify(q.correctMatches);
        }

        const earned = isCorrect ? 100 : 0;
        const nextScore = myScore + earned;
        if (isCorrect) setMyScore(nextScore);

        setAnswerResult({ isCorrect, earnedScore: earned });
        setReviewData({ question: q, stats });
        quizRoom.track({ score: nextScore, hasAnswered: true });
      })
      .on('broadcast', { event: 'leaderboard_updated' }, ({ payload }) => { setLeaderboard(payload); })
      .on('broadcast', { event: 'podium_updated' }, ({ payload }) => { setPodiumData(payload); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });

    quizRoom.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await quizRoom.track({ score: 0, hasAnswered: false });
        quizRoom.send({ type: 'broadcast', event: 'player_joined', payload: { username } });
      }
    });

    setChannel(quizRoom);
    return () => { quizRoom.unsubscribe(); };
  }, [isJoined, pin, username, currentQuestion, userMatches, multiSelected, orderState, myScore, singleSelected]);

  // 玩家端：準備倒數計時器
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (isPreparing && prepareTimeLeft > 0) {
      timerId = setTimeout(() => setPrepareTimeLeft(prepareTimeLeft - 1), 1000);
    }
    return () => clearTimeout(timerId);
  }, [isPreparing, prepareTimeLeft]);

  // 玩家端：正式作答倒數計時器
  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;
    if (currentQuestion && timeLeft > 0 && !hasAnswered && !leaderboard && !reviewData && !podiumData && !isPreparing) {
      timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000); 
      if (timeLeft <= 5) { sfx.tick.currentTime = 0; sfx.tick.play().catch(()=>{}); }
    } else { sfx.tick.pause(); }

    if (timeLeft === 0 && currentQuestion && !hasAnswered && !isPreparing) {
      setHasAnswered(true);
      if (channel) {
         channel.track({ score: myScore, hasAnswered: true });
         channel.send({ type: 'broadcast', event: 'player_answered', payload: { username } }); // 時間到強制送出
      }
    }
    return () => clearTimeout(timerId);
  }, [currentQuestion, timeLeft, hasAnswered, leaderboard, reviewData, podiumData, isPreparing]);

  const handleJoinArena = () => { if (username.trim() && pin.trim()) { setIsJoined(true); unlockAudio(); } };
  
  // 💡 修正 BUG 1：額外發送 player_answered 廣播，讓主持人畫面零延遲更新
  const submitPlayerAnswer = () => {
    setHasAnswered(true);
    if (channel) {
      channel.track({ score: myScore, hasAnswered: true });
      channel.send({ type: 'broadcast', event: 'player_answered', payload: { username } });
    }
  };

  const handleChoiceClick = (answerId: string) => { if (!hasAnswered) { setSingleSelected(answerId); submitPlayerAnswer(); } };
  const toggleMultiSelect = (optId: string) => { if (hasAnswered) return; setMultiSelected(prev => prev.includes(optId) ? prev.filter(id => id !== optId) : [...prev, optId]); };
  const handleMultiSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(); } };
  const moveOrderUp = (index: number) => { if (index === 0 || hasAnswered) return; const newArr = [...orderState]; [newArr[index - 1], newArr[index]] = [newArr[index], newArr[index - 1]]; setOrderState(newArr); };
  const moveOrderDown = (index: number) => { if (index === orderState.length - 1 || hasAnswered) return; const newArr = [...orderState]; [newArr[index + 1], newArr[index]] = [newArr[index], newArr[index + 1]]; setOrderState(newArr); };
  const handleOrderSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(); } };
  const handleMatchSubmit = () => { if (!hasAnswered) { submitPlayerAnswer(); } };
  const handleTopClick = (id: string) => { setActiveTopId(id === activeTopId ? null : id); setUserMatches(prev => { const newMatches = { ...prev }; if (newMatches[id]) delete newMatches[id]; return newMatches; }); };
  const handleBottomClick = (bottomId: string) => { setUserMatches(prev => { const newMatches = { ...prev }; let existingTopKey = null; for (const key in newMatches) { if (newMatches[key] === bottomId) existingTopKey = key; } if (activeTopId) { if (existingTopKey) delete newMatches[existingTopKey]; newMatches[activeTopId] = bottomId; setActiveTopId(null); } else { if (existingTopKey) delete newMatches[existingTopKey]; } return newMatches; }); };

  const handleReturnToDashboard = () => { window.location.reload(); };

  const sortedPlayers = [...(players || [])].sort((a, b) => b.score - a.score);
  const myRank = sortedPlayers.findIndex(p => p.username === username) !== -1 ? sortedPlayers.findIndex(p => p.username === username) + 1 : '-';

  return (
    <PageLayout title={roomTitle} bgImg={roomBg}>
      {!isJoined && (
        <div className="game-panel login-panel" style={{ width: '95%', maxWidth: '400px', margin: '15vh auto 0', background: 'rgba(10, 15, 30, 0.85)' }}>
          <h2 style={{ color: '#FFD700', marginBottom: '1.5rem', fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>進入競技場</h2> 
          <input type="text" placeholder="房間代碼 (PIN)" value={pin} onChange={(e) => setPin(e.target.value)} className="game-input" disabled={!!searchParams.get('pin')} />
          <input type="text" placeholder="您的召喚師暱稱" value={username} onChange={(e) => setUsername(e.target.value)} className="game-input" />
          <button className="btn-summon" onClick={handleJoinArena} style={{ background: 'linear-gradient(90deg, #f39c12, #e67e22)' }}>Ready!</button> 
        </div>
      )}

      {isJoined && !isPreparing && !currentQuestion && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel login-panel" style={{ width: '95%', maxWidth: '400px', margin: '15vh auto 0', textAlign: 'center' }}>
          <h2 style={{ color: '#FFD700', fontSize: '2.2rem', marginBottom: '1rem', textShadow: '0 0 10px rgba(241,196,15,0.8)' }}>房號: {pin}</h2>
          <p style={{ fontSize: '1.4rem', color: '#3498db', fontWeight: 'bold' }}>連線成功，等待主持人開始...</p> 
        </div>
      )}

      {/* 💡 玩家畫面：準備階段提示 */}
      {isJoined && isPreparing && prepareData && (
        <div className="game-panel question-transition" style={{ width: '95%', maxWidth: '600px', margin: '10vh auto', textAlign: 'center', padding: '3rem 2rem' }}>
           <h2 style={{ fontSize: '2rem', color: '#bdc3c7', marginBottom: '2rem', letterSpacing: '3px' }}>⚔️ 準備迎接挑戰</h2>
           <div style={{ fontSize: '3rem', fontWeight: '900', color: qTypeColors[prepareData.type] || '#fff', textShadow: '0 0 20px rgba(255,255,255,0.3)', marginBottom: '2rem' }}>
             {qTypeLabels[prepareData.type]}
           </div>
           <div style={{ fontSize: '5rem', color: '#f1c40f', textShadow: '0 4px 10px rgba(0,0,0,0.5)', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>
             {prepareTimeLeft}
           </div>
        </div>
      )}

      {isJoined && currentQuestion && !isPreparing && !leaderboard && !reviewData && !podiumData && (
        <div className="game-panel question-transition" style={{ width: '95%', maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f1c40f', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '15px', borderBottom: '2px solid rgba(255,215,0,0.3)', paddingBottom: '10px' }}>
            <span>👤 {username}</span><span>🏆 積分: {myScore} | 🏅 排名: {myRank}</span>
          </div>
          
          <div style={{ position: 'relative', width: '100%', height: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem', border: '1px solid rgba(255,215,0,0.5)' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, #f39c12, #f1c40f)', width: `${((currentQuestion?.currentQIndex || 1) / (currentQuestion?.totalQuestions || 1)) * 100}%`, transition: 'width 0.5s' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <span style={{ background: qTypeColors[currentQuestion.type] || '#7f8c8d', color: '#fff', padding: '4px 10px', borderRadius: '8px', fontSize: '1rem', fontWeight: '900' }}>{qTypeLabels[currentQuestion.type] || '未知'}</span>
            <h2 style={{ color: '#FFF', fontSize: '1.3rem', margin: 0, textAlign: 'left', lineHeight: '1.3' }}>{currentQuestion?.text}</h2>
          </div>

          <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
            <div style={{ height: '100%', background: timeLeft <= 5 ? '#e74c3c' : '#2ecc71', width: `${(timeLeft / (currentQuestion?.timeLimit || 15)) * 100}%`, transition: 'width 1s linear' }} />
          </div>

          {(currentQuestion?.type === 'guess' || currentQuestion?.type === 'img_choice') && !hasAnswered && (
             <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                <div style={{ width: '100%', maxWidth: '350px', height: '200px', borderRadius: '15px', overflow: 'hidden', border: '2px solid #f1c40f', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <img src={currentQuestion.guessImg} alt="q" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: currentQuestion.type === 'guess' ? 'cover' : 'contain', width: currentQuestion.type === 'guess' ? '100%' : 'auto', filter: currentQuestion.type === 'guess' ? `blur(${(timeLeft / currentQuestion.timeLimit) * 25}px) grayscale(${(timeLeft / currentQuestion.timeLimit) * 100}%)` : 'none', transition: currentQuestion.type === 'guess' ? 'filter 1s linear' : 'none' }} />
                </div>
             </div>
          )}

          {(currentQuestion?.type === 'choice' || currentQuestion?.type === 'guess' || currentQuestion?.type === 'img_choice') && !hasAnswered && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(currentQuestion?.options || []).map((opt: any) => (
                <button key={opt.id} onClick={() => handleChoiceClick(opt.id)} style={{ padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', background: 'rgba(30, 40, 60, 0.8)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)', borderLeft: `6px solid ${opt.color}`, cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)', transition: 'transform 0.1s' }}>{opt.text}</button>
              ))}
            </div>
          )}

          {currentQuestion?.type === 'tf' && !hasAnswered && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <button onClick={() => handleChoiceClick('O')} style={{ padding: '1.5rem', fontSize: '4rem', fontWeight: '900', color: '#ffffff', background: 'linear-gradient(145deg, #00e673, #00b359)', borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 0 #008040' }}>O</button>
              <button onClick={() => handleChoiceClick('X')} style={{ padding: '1.5rem', fontSize: '4rem', fontWeight: '900', color: '#ffffff', background: 'linear-gradient(145deg, #ff4d4d, #e60000)', borderRadius: '15px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 0 #b30000' }}>X</button>
            </div>
          )}

          {currentQuestion?.type === 'multi' && !hasAnswered && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '5px', fontWeight: 'bold' }}>💡 點擊選取多個答案，完成後點擊下方送出</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {(currentQuestion?.options || []).map((opt: any) => {
                  const isSelected = multiSelected.includes(opt.id);
                  return (
                    <button key={opt.id} onClick={() => toggleMultiSelect(opt.id)} style={{ padding: '1rem', fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', background: isSelected ? 'rgba(52, 152, 219, 0.6)' : 'rgba(30, 40, 60, 0.8)', borderRadius: '10px', border: isSelected ? '2px solid #3498db' : '1px solid rgba(255,255,255,0.1)', borderLeft: `6px solid ${opt.color}`, cursor: 'pointer', transition: 'all 0.2s' }}>{isSelected && '✔️ '} {opt.text}</button>
                  );
                })}
              </div>
              <button className="btn-summon" onClick={handleMultiSubmit} disabled={multiSelected.length === 0} style={{ marginTop: '10px', background: multiSelected.length > 0 ? 'linear-gradient(90deg, #2ecc71, #27ae60)' : '#7f8c8d' }}>送出解答</button>
            </div>
          )}

          {currentQuestion?.type === 'order' && !hasAnswered && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '5px', fontWeight: 'bold' }}>💡 由上而下排出正確順序</p>
              {orderState.map((opt, idx) => (
                <div key={opt.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(30, 40, 60, 0.8)', padding: '10px', borderRadius: '10px', borderLeft: `6px solid ${opt.color}` }}>
                  <span style={{ color: '#f1c40f', fontWeight: '900', marginRight: '10px', fontSize: '1.2rem', width: '25px' }}>{idx + 1}.</span>
                  <span style={{ color: '#fff', flex: 1, fontSize: '1.1rem', textAlign: 'left', fontWeight: 'bold' }}>{opt.text}</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => moveOrderUp(idx)} disabled={idx === 0} style={{ padding:'8px 12px', background:'#3498db', border:'none', borderRadius:'6px', cursor: idx===0?'not-allowed':'pointer', opacity: idx===0?0.3:1 }}>⬆️</button>
                    <button onClick={() => moveOrderDown(idx)} disabled={idx === orderState.length - 1} style={{ padding:'8px 12px', background:'#e74c3c', border:'none', borderRadius:'6px', cursor: idx===orderState.length-1?'not-allowed':'pointer', opacity: idx===orderState.length-1?0.3:1 }}>⬇️</button>
                  </div>
                </div>
              ))}
              <button className="btn-summon" onClick={handleOrderSubmit} style={{ marginTop: '10px', background: 'linear-gradient(90deg, #2ecc71, #27ae60)' }}>確認排序並送出</button>
            </div>
          )}

          {currentQuestion?.type === 'match' && !hasAnswered && (
            <div>
              <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '10px', fontWeight: 'bold' }}>💡 點擊上方魔靈，再點下方圖片配對</p>
              <div className="match-grid">
                {(currentQuestion?.topItems || []).map((item: any) => {
                  const isActive = activeTopId === item.id; const isMatched = Boolean(userMatches[item.id]); const itemColor = topColors[item.id] || '#fff';
                  return (
                    <div key={item.id} onClick={() => handleTopClick(item.id)} className={`match-item ${isActive ? 'active' : ''}`} style={{ borderColor: isActive || isMatched ? itemColor : 'transparent', background: 'rgba(30, 40, 60, 0.8)' }}>
                      <img src={item.img} alt="top" referrerPolicy="no-referrer" crossOrigin="anonymous" /> <p style={{ fontWeight: 'bold' }}>{item.name}</p> {isMatched && <div className="match-badge" style={{ background: itemColor }}>✓</div>}
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
              <button className="btn-summon" onClick={handleMatchSubmit} disabled={Object.keys(userMatches).length !== currentQuestion?.topItems?.length} style={{ marginTop: '15px', background: Object.keys(userMatches).length !== currentQuestion?.topItems?.length ? '#7f8c8d' : 'linear-gradient(90deg, #3498db, #2980b9)' }}>確認送出配對！</button>
            </div>
          )}
        </div>
      )}

      {isJoined && leaderboard && !reviewData && !podiumData && (
         <div className="game-panel" style={{ width: '95%', maxWidth: '600px', margin: '0 auto', paddingBottom: '1rem' }}>
           <h2 style={{ color: '#FFD700', fontSize: '1.8rem', marginBottom: '1.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>🏆 排名結算</h2>
           <LeaderboardView data={leaderboard} />
         </div>
      )}

      {isJoined && reviewData && (
        <div className="game-panel" style={{ width: '95%', maxWidth: '600px', margin: '0 auto', paddingBottom: '1rem' }}>
          <h2 style={{ color: '#3498db', fontSize: '1.8rem', marginBottom: '1rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>正確答案</h2>
          
          {(reviewData.question.type === 'guess' || reviewData.question.type === 'img_choice') && (
             <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                <div style={{ width: reviewData.question.type === 'img_choice' ? '100%' : '150px', maxWidth: '350px', height: reviewData.question.type === 'img_choice' ? '200px' : '150px', borderRadius: '15px', overflow: 'hidden', border: '3px solid #2ecc71', boxShadow: '0 0 15px rgba(46, 204, 113, 0.4)', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <img src={reviewData.question.type === 'img_choice' ? (reviewData.question.answerImg || reviewData.question.guessImg) : reviewData.question.guessImg} alt="answer" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: reviewData.question.type === 'guess' ? 'cover' : 'contain' }} />
                </div>
             </div>
          )}

          {(reviewData.question.type === 'choice' || reviewData.question.type === 'multi' || reviewData.question.type === 'guess' || reviewData.question.type === 'img_choice') && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               {reviewData.question.options.map((opt: any) => {
                 const isC = reviewData.question.type === 'multi' ? reviewData.question.correctAnswers.includes(opt.id) : opt.id === reviewData.question.correctAnswer;
                 return (<div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: isC ? 'rgba(46, 204, 113, 0.25)' : 'rgba(30, 40, 60, 0.5)', border: isC ? '2px solid #2ecc71' : '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold' }}><span style={{ color: isC ? '#2ecc71' : '#fff' }}>{isC && '✔️ '} {opt.text}</span><span style={{ color: '#bdc3c7' }}>{reviewData.stats[opt.id] || 0} 人</span></div>);
               })}
             </div>
          )}

          {reviewData.question.type === 'order' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ color: '#2ecc71', fontSize: '1.1rem', marginBottom: '5px', fontWeight: 'bold', textAlign: 'center' }}>🎯 正確排序</p>
              {(reviewData.question.options || []).map((opt: any, idx: number) => (
                <div key={opt.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(46, 204, 113, 0.15)', padding: '10px', borderRadius: '10px', border: '1px solid #2ecc71' }}>
                   <span style={{ color: '#2ecc71', fontWeight: '900', marginRight: '10px', fontSize: '1.2rem', width: '25px' }}>{idx + 1}.</span>
                   <span style={{ color: '#fff', flex: 1, fontSize: '1.1rem', textAlign: 'left', fontWeight: 'bold' }}>{opt.text}</span>
                </div>
              ))}
            </div>
          )}

          {reviewData.question.type === 'tf' && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100px', height: '100px', fontSize: '4rem', fontWeight: '900', color: '#ffffff', background: reviewData.question.correctAnswer === 'O' ? 'linear-gradient(145deg, #00e673, #00b359)' : 'linear-gradient(145deg, #ff4d4d, #e60000)', borderRadius: '20px', margin: '1rem auto' }}>
                  {reviewData.question.correctAnswer}
                </div>
             </div>
          )}
          {reviewData.question.type === 'match' && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <p style={{ color: '#2ecc71', fontSize: '1.1rem', marginBottom: '5px', fontWeight: 'bold', textAlign: 'center' }}>🎯 正確配對</p>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                 {(reviewData.question.topItems || []).map((top: any) => {
                   const correctBottomId = reviewData.question.correctMatches[top.id];
                   const bottomItem = reviewData.question.bottomItems?.find((b: any) => b.id === correctBottomId);
                   return (
                     <div key={top.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'rgba(46, 204, 113, 0.15)', padding: '10px', borderRadius: '10px', border: '1px solid #2ecc71' }}>
                        <img src={top.img} alt="top" style={{ width: '60px', height: '60px', objectFit: 'contain', background: '#000', borderRadius: '8px' }} />
                        <span style={{ fontSize: '1.2rem', margin: '4px 0', color: '#2ecc71' }}>⬇️</span>
                        <img src={bottomItem?.img} alt="bottom" style={{ width: '60px', height: '60px', objectFit: 'contain', background: '#000', borderRadius: '8px' }} />
                     </div>
                   );
                 })}
               </div>
             </div>
          )}
        </div>
      )}

      {isJoined && podiumData && (
        <div className="game-panel" style={{ width: '95%', maxWidth: '600px', margin: '0 auto', animation: 'bounceIn 1s ease', position: 'relative' }}>
          <div className="firework fw-1">🎆</div><div className="firework fw-2">🎇</div>
          <div className="podium-content">
            <h2 style={{ color: '#FFD700', fontSize: '2.5rem', marginBottom: '2rem' }}>🏆 傳奇誕生 🏆</h2>
            {podiumData[0] && <h3 style={{color: '#f1c40f', fontSize: '2.2rem'}}>🥇 {podiumData[0].username} <span style={{fontSize:'1.2rem'}}>({podiumData[0].score}分)</span></h3>}
            {podiumData[1] && <h4 style={{color: '#bdc3c7', fontSize: '1.6rem'}}>🥈 {podiumData[1]?.username} <span style={{fontSize:'1rem'}}>({podiumData[1]?.score}分)</span></h4>}
            {podiumData[2] && <h4 style={{color: '#e67e22', fontSize: '1.4rem'}}>🥉 {podiumData[2]?.username} <span style={{fontSize:'0.9rem'}}>({podiumData[2]?.score}分)</span></h4>}
          </div>
          <button className="btn-summon" onClick={handleReturnToDashboard} style={{ background: 'linear-gradient(90deg, #3498db, #2980b9)', marginTop: '30px' }}>🏠 返回大廳</button>
        </div>
      )}
    </PageLayout>
  );
}

// ==========================================
// 👑 專屬管理端介面
// ==========================================
function AdminApp() {
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [quizPacks, setQuizPacks] = useState<any[]>([]);
  const [editingPack, setEditingPack] = useState<any>(null); 
  
  const [hostingPin, setHostingPin] = useState<string | null>(null);
  const [hostingUrl, setHostingUrl] = useState<string | null>(null);
  const [roomTitle, setRoomTitle] = useState(DEFAULT_TITLE);
  const [roomBg, setRoomBg] = useState(DEFAULT_BG);
  
  // 💡 新增：準備階段狀態 (Host)
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

  const [players, setPlayers] = useState<any[]>([]);
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

  // 主持人端：準備倒數計時器
  useEffect(() => {
    let prepTimer: ReturnType<typeof setTimeout>;
    if (isPreparing && prepareTimeLeft > 0) {
       prepTimer = setTimeout(() => setPrepareTimeLeft(prepareTimeLeft - 1), 1000);
       sfx.tick.currentTime = 0; sfx.tick.play().catch(()=>{});
    } else if (isPreparing && prepareTimeLeft === 0) {
       setIsPreparing(false);
       sendNextQuestionActual(); // 時間到，自動發送題目
    }
    return () => clearTimeout(prepTimer);
  }, [isPreparing, prepareTimeLeft]);

  // 主持人端：正式作答倒數計時器
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
    setAdminUser(username);
    fetchQuizzes(username);
  };

  const handleHostGame = (pack: any) => {
    const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
    setHostingPin(generatedPin);
    setHostingUrl(`${window.location.origin}/?pin=${generatedPin}`);
    setRoomTitle(pack.title || DEFAULT_TITLE);
    setRoomBg(pack.backgroundImg || DEFAULT_BG);
    setEditingPack(pack); 
    setCurrentQIndex(0);

    const hostChannel = supabase.channel(`room_${generatedPin}`);
    hostChannel
      .on('presence', { event: 'sync' }, () => {
        const state = hostChannel.presenceState();
        // 更新玩家列表，但不覆蓋已存在的答題狀態 (避免狀態倒退)
        setPlayers(prev => {
          const newList = Object.keys(state).map(key => ({ username: key, score: state[key][0]?.score || 0, hasAnswered: state[key][0]?.hasAnswered || false }));
          return newList.map(newP => { const oldP = prev.find(p => p.username === newP.username); return oldP?.hasAnswered ? { ...newP, hasAnswered: true } : newP; });
        });
      })
      .on('broadcast', { event: 'player_joined' }, () => {
        hostChannel.send({ type: 'broadcast', event: 'room_info', payload: { title: pack.title, backgroundImg: pack.backgroundImg } });
      })
      // 💡 修正 BUG 1：監聽專屬廣播，零延遲更新該玩家的「已答題」狀態
      .on('broadcast', { event: 'player_answered' }, ({ payload }) => {
        setPlayers(prev => prev.map(p => p.username === payload.username ? { ...p, hasAnswered: true } : p));
      });

    hostChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') { unlockAudio(); }
    });
    setChannel(hostChannel);
  };

  // 💡 修正 BUG 3：按下下一題時，先觸發 PREPARE 階段
  const sendNextQuestion = () => {
    if (!editingPack || !editingPack.questions || editingPack.questions.length <= currentQIndex) return;
    const q = editingPack.questions[currentQIndex];
    const prepPayload = { type: q.type, currentQIndex: currentQIndex + 1, totalQuestions: editingPack.questions.length };

    setIsPreparing(true);
    setPrepareTimeLeft(3);
    setPrepareData(prepPayload);
    setLeaderboard(null); setReviewData(null); setPodiumData(null); setCurrentQuestion(null);

    channel.send({ type: 'broadcast', event: 'prepare_question', payload: prepPayload });
  };

  // 3秒倒數結束後，真正發送題目
  const sendNextQuestionActual = () => {
    const q = editingPack.questions[currentQIndex];
    const qPayload = { ...q, currentQIndex: currentQIndex + 1, totalQuestions: editingPack.questions.length };
    setCurrentQuestion(qPayload); setTimeLeft(q.timeLimit || 15);
    channel.send({ type: 'broadcast', event: 'receive_question', payload: qPayload });
  };

  const showLeaderboard = () => {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    setLeaderboard(sorted);
    channel.send({ type: 'broadcast', event: 'leaderboard_updated', payload: sorted });
  };

  const showReviewAnswer = () => {
    const stats: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, O: 0, X: 0 };
    players.forEach(() => {
      const opts = ['A', 'B', 'C', 'D'];
      const randOpt = opts[Math.floor(Math.random() * opts.length)];
      stats[randOpt] = (stats[randOpt] || 0) + 1;
    });
    const hasNext = currentQIndex + 1 < (editingPack?.questions?.length || 0);
    const reviewPayload = { question: currentQuestion, stats, hasNextQuestion: hasNext };
    setReviewData(reviewPayload); setLeaderboard(null);
    channel.send({ type: 'broadcast', event: 'reveal_answer', payload: reviewPayload });
    setCurrentQIndex(currentQIndex + 1);
  };

  const showFinalPodium = () => {
    const top3 = [...players].sort((a, b) => b.score - a.score).slice(0, 3);
    setPodiumData(top3); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null);
    channel.send({ type: 'broadcast', event: 'podium_updated', payload: top3 });
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

  const handleImageUpload = (index: number, field: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 300 * 1024) return alert(`圖片太大！限 300KB 以內。`);
    const reader = new FileReader(); reader.onload = (event) => { const newPairs = [...matchPairs]; newPairs[index] = { ...newPairs[index], [field]: event.target?.result as string }; setMatchPairs(newPairs); }; reader.readAsDataURL(file);
  };

  const handleGuessImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 300 * 1024) return alert(`圖片太大！限 300KB 以內。`);
    const reader = new FileReader(); reader.onload = (event) => { setNewGuessImg(event.target?.result as string); }; reader.readAsDataURL(file);
  };
  
  const handleAnswerImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 300 * 1024) return alert(`圖片太大！限 300KB 以內。`);
    const reader = new FileReader(); reader.onload = (event) => { setNewAnswerImg(event.target?.result as string); }; reader.readAsDataURL(file);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as 'choice' | 'match' | 'tf' | 'multi' | 'guess' | 'order' | 'img_choice';
    setQType(type);
    if (type === 'tf') setNewTime(5); else if (type === 'match' || type === 'order') setNewTime(30); else if (type === 'guess') setNewTime(12); else if (type === 'img_choice') setNewTime(15); else setNewTime(10);
  };

  const toggleMultiAnsEditor = (val: string) => { setNewMultiAns(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]); };

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
    setHostingPin(null); setHostingUrl(null); setPlayers([]); setCurrentQuestion(null); setLeaderboard(null); setReviewData(null); setPodiumData(null);
    setRoomTitle(DEFAULT_TITLE); setRoomBg(DEFAULT_BG); fetchQuizzes(adminUser!);
  };

  let displayTitle = '創作者儀表板';
  let displayBg = DEFAULT_BG;
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
              <h2 style={{ color: '#e74c3c', fontSize: '2.5rem', marginBottom: '2vh' }}>👑 主持人控場中心</h2>
              <h3 style={{ color: '#f1c40f', fontSize: '4.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)', margin: '1vh 0' }}>房號: {hostingPin}</h3>
              <p style={{ color: '#2ecc71', margin: '2vh 0', fontSize: '1.6rem' }}>玩家加入連結: <br/><span style={{color: '#3498db', textDecoration: 'underline', fontSize: '2rem'}}>{hostingUrl}</span></p>
              <p style={{ fontSize: '2rem', fontWeight: 'bold' }}>目前進場: <span style={{ color: '#f1c40f', fontSize: '2.5rem' }}>{players.length}</span> 人</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', margin: '3vh 0', maxHeight: '20vh', overflowY: 'auto', padding: '15px', background: 'rgba(0,0,0,0.3)', borderRadius: '15px' }}>
                {players.map((p, i) => <span key={i} style={{ background: 'rgba(255,215,0,0.15)', padding: '8px 15px', borderRadius: '8px', fontSize: '1.2rem', color: '#FFD700', border: '1px solid rgba(255,215,0,0.3)' }}>{p.username}</span>)}
              </div>
              <button className="btn-summon" onClick={sendNextQuestion} style={{ fontSize: '2rem', padding: '15px 60px', background: 'linear-gradient(90deg, #2ecc71, #27ae60)' }}>▶️ 正式開始遊戲</button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#bdc3c7', fontSize: '1.2rem', marginBottom: '1.5vh', borderBottom: '2px solid #444', paddingBottom: '10px' }}>
                <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>👑 主持人大螢幕模式</span>
                <span>房間: <strong style={{color:'#fff'}}>{hostingPin}</strong> | 總進場: <strong style={{color:'#fff'}}>{players.length}</strong> 人</span>
              </div>

              {/* 💡 主持人端：準備階段提示 */}
              {isPreparing && prepareData && (
                <div className="question-transition" style={{ padding: '5vh 0' }}>
                   <h2 style={{ fontSize: '3.5rem', color: '#bdc3c7', marginBottom: '3vh', letterSpacing: '3px' }}>⚔️ 準備迎接挑戰</h2>
                   <div style={{ fontSize: '5.5rem', fontWeight: '900', color: qTypeColors[prepareData.type] || '#fff', textShadow: '0 0 25px rgba(255,255,255,0.4)', marginBottom: '3vh' }}>
                     {qTypeLabels[prepareData.type]}
                   </div>
                   <div style={{ fontSize: '8rem', color: '#f1c40f', textShadow: '0 5px 15px rgba(0,0,0,0.6)', fontWeight: 'bold', animation: 'pulse 1s infinite' }}>
                     {prepareTimeLeft}
                   </div>
                </div>
              )}

              {currentQuestion && !leaderboard && !reviewData && !podiumData && !isPreparing && (
                <div className="question-transition">
                  <div style={{ position: 'relative', width: '100%', height: '28px', background: 'rgba(255,255,255,0.1)', borderRadius: '14px', overflow: 'hidden', marginBottom: '1.5vh', border: '1px solid rgba(255,215,0,0.5)' }}>
                    <div style={{ height: '100%', background: 'linear-gradient(90deg, #f39c12, #f1c40f)', width: `${((currentQuestion?.currentQIndex || 1) / (currentQuestion?.totalQuestions || 1)) * 100}%`, transition: 'width 0.5s' }} />
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontWeight: '900', fontSize: '1.2rem', textShadow: '1px 1px 2px #000' }}>
                      題目進度: {currentQuestion?.currentQIndex || 1} / {currentQuestion?.totalQuestions || 1}
                    </div>
                  </div>

                  <h3 style={{ color: '#34db98', marginBottom: '1.5vh', fontSize: '1.8rem', margin: '1vh 0' }}>⏳ 題目作答中... (已答題: <span style={{color:'#fff'}}>{players.filter(p => p.hasAnswered).length} / {players.length}</span> 人)</h3>
                  
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
                      <div style={{ padding: '25px', background: 'linear-gradient(145deg, #00e673, #00b359)', borderRadius: '15px', color: '#ffffff', textAlign:'center', fontSize:'4rem', fontFamily: 'Arial, sans-serif', fontWeight: '900', boxShadow: '0 8px 0 #008040, 0 10px 15px rgba(0,0,0,0.4)', textShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>O</div>
                      <div style={{ padding: '25px', background: 'linear-gradient(145deg, #ff4d4d, #e60000)', borderRadius: '15px', color: '#ffffff', textAlign:'center', fontSize:'4rem', fontFamily: 'Arial, sans-serif', fontWeight: '900', boxShadow: '0 8px 0 #b30000, 0 10px 15px rgba(0,0,0,0.4)', textShadow: '0 4px 8px rgba(0,0,0,0.3)' }}>X</div>
                    </div>
                  )}
                  <button className="btn-summon" onClick={showLeaderboard} style={{ background: 'linear-gradient(90deg, #9b59b6, #8e44ad)', marginTop: '3vh', fontSize: '1.4rem', padding: '15px' }}>📊 結算當前排名</button>
                </div>
              )}
              
              {leaderboard && !reviewData && !podiumData && !isPreparing && (
                <div><h2 style={{ color: '#FFD700', fontSize: '2.5rem', marginBottom: '2vh', textShadow: '0 0 15px rgba(241,196,15,0.5)' }}>🏆 排名結算</h2><LeaderboardView data={leaderboard} />
                <button className="btn-summon" onClick={showReviewAnswer} style={{ background: 'linear-gradient(90deg, #34495e, #2c3e50)', marginTop: '2vh', fontSize: '1.4rem', padding: '15px' }}>🔍 揭曉正確答案</button></div>
              )}

              {reviewData && (
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
                  {reviewData.hasNextQuestion ? <button className="btn-summon" onClick={sendNextQuestion} style={{ background: 'linear-gradient(90deg, #2ecc71, #27ae60)', marginTop: '3vh', fontSize: '1.5rem', padding: '15px' }}>▶️ 下一題</button> : <button className="btn-summon" onClick={showFinalPodium} style={{ background: 'linear-gradient(90deg, #f1c40f, #f39c12)', marginTop: '3vh', fontSize: '1.5rem', padding: '15px' }}>🏆 揭曉最終榮耀</button>}
                </div>
              )}

              {podiumData && (
                <div style={{ animation: 'bounceIn 1s ease', position: 'relative' }}>
                  <div className="firework fw-1">🎆</div><div className="firework fw-2">🎇</div>
                  <div className="podium-content">
                    <h2 style={{ color: '#FFD700', fontSize: '4rem', marginBottom: '2vh', textShadow: '0 0 20px rgba(255,215,0,0.8)' }}>🏆 傳奇誕生 🏆</h2>
                    {podiumData[0] && <h3 style={{color: '#f1c40f', fontSize: '3.5rem', textShadow: '0 4px 8px rgba(0,0,0,0.8)', margin: '1vh 0'}}>🥇 {podiumData[0].username} <span style={{fontSize:'1.8rem'}}>({podiumData[0].score}分)</span></h3>}
                    {podiumData[1] && <h4 style={{color: '#bdc3c7', fontSize: '2.5rem', textShadow: '0 3px 6px rgba(0,0,0,0.8)', margin: '1vh 0'}}>🥈 {podiumData[1]?.username} <span style={{fontSize:'1.4rem'}}>({podiumData[1]?.score}分)</span></h4>}
                    {podiumData[2] && <h4 style={{color: '#e67e22', fontSize: '2rem', textShadow: '0 2px 4px rgba(0,0,0,0.8)', margin: '1vh 0'}}>🥉 {podiumData[2]?.username} <span style={{fontSize:'1.2rem'}}>({podiumData[2]?.score}分)</span></h4>}
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

  // 👑 【題庫編輯器】
  if (editingPack) {
    return (
      <PageLayout title={displayTitle} bgImg={displayBg}>
        <div className="game-panel admin-mega-panel" style={{ margin: '0 auto', paddingBottom: '3rem', background: 'rgba(15, 20, 35, 0.95)', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
            <h2 style={{ color: '#FFD700', margin: 0 }}>✏️ 題庫編輯器</h2>
            <button onClick={() => { setEditingPack(null); handleCancelEditQuestion(); }} style={{ padding: '0.6rem 1.2rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>返回列表</button>
          </div>

          <input type="text" value={editingPack.title} onChange={(e) => setEditingPack({...editingPack, title: e.target.value})} placeholder="題庫包名稱 (建議簡短吸睛)" className="game-input" style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f1c40f', background: 'rgba(0,0,0,0.5)' }} />

          <div style={{ marginBottom: '20px' }}>
            <p style={{ color: '#3498db', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 'bold' }}>* 選擇自訂遊戲背景圖 (建議尺寸 1920x1080 16:9，支援 JPG/PNG，限 1MB 內)</p>
            <label style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.4)', border: '2px dashed #3498db', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', overflow: 'hidden', transition: 'border 0.3s' }}>
              {editingPack.backgroundImg ? <img src={editingPack.backgroundImg} alt="bg" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }} /> : <span style={{fontSize: '1.1rem', color: '#3498db', fontWeight: 'bold'}}>+ 點擊上傳背景圖 (未上傳則使用系統預設)</span>}
              <input type="file" accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 1024 * 1024) return alert('背景圖太大！限 1MB 以內。');
                const reader = new FileReader();
                reader.onload = (ev) => setEditingPack({ ...editingPack, backgroundImg: ev.target?.result as string });
                reader.readAsDataURL(file);
              }} />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
            {(editingPack.questions || []).map((q: any, idx: number) => {
              return (
              <div key={q.id} style={{ background: 'rgba(255,255,255,0.08)', padding: '1.2rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `6px solid ${qTypeColors[q.type] || '#7f8c8d'}` }}>
                <div style={{ flex: 1, paddingRight: '15px' }}>
                  <span style={{ background: qTypeColors[q.type], padding: '4px 10px', borderRadius: '6px', fontSize: '0.85rem', marginRight: '10px', color: '#fff', fontWeight: 'bold' }}>{qTypeLabels[q.type]}</span>
                  <strong style={{ fontSize: '1.1rem', color: '#fff' }}>Q{idx + 1}. {q.text}</strong>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleEditQuestion(q)} style={{ background: 'linear-gradient(90deg, #f39c12, #e67e22)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>修改</button>
                  <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'linear-gradient(90deg, #e74c3c, #c0392b)', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>刪除</button>
                </div>
              </div>
            )})}
          </div>

          <div id="question-edit-form" style={{ background: editingQuestionId ? 'rgba(243, 156, 18, 0.15)' : 'rgba(0,0,0,0.6)', padding: '2rem', borderRadius: '15px', marginTop: '2.5rem', border: editingQuestionId ? '2px solid #f39c12' : '1px dashed #7f8c8d', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
              <h3 style={{ color: editingQuestionId ? '#f39c12' : '#2ecc71', margin: 0, fontSize: '1.4rem' }}>{editingQuestionId ? '✏️ 修改當前題目' : '➕ 新增一題'}</h3>
              {editingQuestionId && <button onClick={handleCancelEditQuestion} style={{ background: 'transparent', border: '1px solid #e74c3c', color: '#e74c3c', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}>取消修改</button>}
            </div>

            <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
              <select value={qType} onChange={handleTypeChange} className="game-input" style={{ flex: 1, fontSize: '1.1rem' }}>
                <option value="choice">單選題</option>
                <option value="img_choice">看圖單選題</option>
                <option value="tf">是非題 (O/X)</option>
                <option value="multi">多選題</option>
                <option value="guess">漸進猜圖題</option>
                <option value="order">排序題 (由上到下)</option>
                <option value="match">圖片配對題</option>
              </select>
              <div style={{ position: 'relative', width: '120px' }}>
                 <span style={{ position: 'absolute', top: '15px', right: '15px', color: '#bdc3c7' }}>秒</span>
                 <input type="number" placeholder="秒數" value={newTime} onChange={(e) => setNewTime(Number(e.target.value))} className="game-input" style={{ width: '100%', paddingRight: '40px', fontSize: '1.1rem' }} />
              </div>
            </div>
            
            <input type="text" placeholder="請輸入完整題目敘述文字" value={newQText} onChange={(e) => setNewQText(e.target.value)} className="game-input" style={{ fontSize: '1.2rem', padding: '15px' }} />

            {(qType === 'guess' || qType === 'img_choice') && (
              <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 'bold' }}>* {qType === 'img_choice' ? '作答提示圖 (必填)' : '請上傳題目原圖 (必填)'}</p>
                  <label style={{ width: '180px', height: '180px', background: 'rgba(0,0,0,0.5)', border: '2px dashed #f1c40f', borderRadius: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                    {newGuessImg ? <img src={newGuessImg} alt="預覽" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{fontSize: '1rem', color: '#f1c40f'}}>+ 選擇圖片</span>}
                    <input type="file" accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={handleGuessImageUpload} />
                  </label>
                </div>
                {qType === 'img_choice' && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <p style={{ color: '#2ecc71', fontSize: '0.9rem', marginBottom: '8px', fontWeight: 'bold' }}>* 解答清晰圖 (公佈用, 必填)</p>
                    <label style={{ width: '180px', height: '180px', background: 'rgba(0,0,0,0.5)', border: '2px dashed #2ecc71', borderRadius: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                      {newAnswerImg ? <img src={newAnswerImg} alt="預覽" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{fontSize: '1rem', color: '#2ecc71'}}>+ 選擇圖片</span>}
                      <input type="file" accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={handleAnswerImageUpload} />
                    </label>
                  </div>
                )}
              </div>
            )}

            {(qType === 'choice' || qType === 'multi' || qType === 'guess' || qType === 'order' || qType === 'img_choice') && (
              <>
                {qType === 'order' && <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '10px', background: 'rgba(241,196,15,0.1)', padding: '10px', borderRadius: '8px' }}>* 請依序(由上至下)在選項 A 到 D 填入正確順序，發送時系統會自動打亂讓玩家排列！</p>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input type="text" placeholder="選項 A (必填)" value={newOptA} onChange={(e) => setNewOptA(e.target.value)} className="game-input" style={{ marginBottom: 0, borderLeft: '5px solid #e53e3e' }} />
                  <input type="text" placeholder="選項 B (必填)" value={newOptB} onChange={(e) => setNewOptB(e.target.value)} className="game-input" style={{ marginBottom: 0, borderLeft: '5px solid #3182ce' }} />
                  <input type="text" placeholder="選項 C (必填)" value={newOptC} onChange={(e) => setNewOptC(e.target.value)} className="game-input" style={{ marginBottom: 0, borderLeft: '5px solid #d69e2e' }} />
                  <input type="text" placeholder="選項 D (必填)" value={newOptD} onChange={(e) => setNewOptD(e.target.value)} className="game-input" style={{ marginBottom: 0, borderLeft: '5px solid #805ad5' }} />
                </div>
                
                {(qType === 'choice' || qType === 'guess' || qType === 'img_choice') && (
                  <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '15px', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px' }}>
                    <span style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 'bold' }}>正確解答為:</span>
                    <select value={newAns} onChange={(e) => setNewAns(e.target.value)} className="game-input" style={{ width: '120px', marginBottom: 0, padding: '8px' }}>
                      <option value="A">選項 A</option><option value="B">選項 B</option><option value="C">選項 C</option><option value="D">選項 D</option>
                    </select>
                  </div>
                )}
                {qType === 'multi' && (
                  <div style={{ marginTop: '15px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                    <span style={{ color: '#fff', display: 'block', marginBottom: '10px', fontSize: '1.1rem', fontWeight: 'bold' }}>勾選正確解答 (可複選):</span>
                    <div style={{ display: 'flex', gap: '20px' }}>
                      {['A', 'B', 'C', 'D'].map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', cursor: 'pointer', fontSize: '1.1rem' }}>
                          <input type="checkbox" checked={newMultiAns.includes(opt)} onChange={() => toggleMultiAnsEditor(opt)} style={{ width: '22px', height: '22px' }} /> 選項 {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {qType === 'tf' && (
              <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '20px', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '10px' }}>
                <span style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 'bold' }}>設定正確答案為:</span>
                <button onClick={() => setNewTfAns('O')} style={{ padding: '15px 35px', fontSize: '2rem', fontFamily: 'Arial, sans-serif', fontWeight: '900', background: newTfAns === 'O' ? 'linear-gradient(145deg, #00e673, #00b359)' : 'rgba(255,255,255,0.1)', color: '#fff', border: newTfAns === 'O' ? '2px solid #fff' : 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: newTfAns === 'O' ? '0 6px 0 #008040' : 'none' }}>O</button>
                <button onClick={() => setNewTfAns('X')} style={{ padding: '15px 35px', fontSize: '2rem', fontFamily: 'Arial, sans-serif', fontWeight: '900', background: newTfAns === 'X' ? 'linear-gradient(145deg, #ff4d4d, #e60000)' : 'rgba(255,255,255,0.1)', color: '#fff', border: newTfAns === 'X' ? '2px solid #fff' : 'none', borderRadius: '12px', cursor: 'pointer', boxShadow: newTfAns === 'X' ? '0 6px 0 #b30000' : 'none' }}>X</button>
              </div>
            )}

            {qType === 'match' && (
              <div style={{ textAlign: 'left', marginTop: '15px' }}>
                <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '15px', background: 'rgba(241,196,15,0.1)', padding: '10px', borderRadius: '8px' }}>* 請依照正確配對組合橫向對齊上傳。建議圖檔為 1:1，單張限 300KB 內。</p>
                {matchPairs.map((pair, index) => (
                  <div key={index} style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center', background: 'rgba(255,255,255,0.08)', padding: '12px', borderRadius: '10px' }}>
                    <span style={{ color: '#fff', width: '25px', fontWeight: 'bold', fontSize: '1.2rem' }}>{index+1}.</span>
                    <input type="text" placeholder="物件名稱" value={pair.tName} onChange={e => { const newPairs = [...matchPairs]; newPairs[index].tName = e.target.value; setMatchPairs(newPairs); }} className="game-input" style={{ padding: '10px', marginBottom: 0, flex: 1 }} /> 
                    <label style={{ flex: 1, height: '50px', background: 'rgba(0,0,0,0.5)', border: '1px dashed #3498db', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                      {pair.tImg ? <img src={pair.tImg} alt="預覽" style={{ height: '100%', objectFit: 'contain' }} /> : <span style={{fontSize: '0.9rem', color: '#3498db'}}>+ 選擇原圖</span>}
                      <input type="file" accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={(e) => handleImageUpload(index, 'tImg', e)} />
                    </label>
                    <span style={{ color: '#2ecc71', margin: '0 5px', fontSize: '1.2rem' }}>🔗</span>
                    <label style={{ flex: 1, height: '50px', background: 'rgba(0,0,0,0.5)', border: '1px dashed #e74c3c', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', overflow: 'hidden' }}>
                      {pair.bImg ? <img src={pair.bImg} alt="預覽" style={{ height: '100%', objectFit: 'contain' }} /> : <span style={{fontSize: '0.9rem', color: '#e74c3c'}}>+ 選擇配對圖</span>}
                      <input type="file" accept="image/jpeg, image/png" style={{ display: 'none' }} onChange={(e) => handleImageUpload(index, 'bImg', e)} />
                    </label>
                  </div>
                ))}
              </div>
            )}

            <button className="btn-summon" onClick={handleSaveQuestion} style={{ marginTop: '25px', background: editingQuestionId ? 'linear-gradient(90deg, #f39c12, #e67e22)' : 'linear-gradient(90deg, #3498db, #2980b9)', fontSize: '1.2rem', padding: '12px' }}>
              {editingQuestionId ? '💾 儲存修改內容' : '➕ 將此題加入題庫'}
            </button>
          </div>

          <button className="btn-summon" onClick={handleSavePack} style={{ marginTop: '30px', background: 'linear-gradient(90deg, #2ecc71, #27ae60)', fontSize: '1.3rem', padding: '15px' }}>💾 完成！儲存整包題庫</button>
        </div>
      </PageLayout>
    );
  }

  // 👑 【創作者儀表板】
  return (
    <PageLayout title={displayTitle} bgImg={displayBg}>
      <div className="game-panel login-panel admin-mega-panel" style={{ margin: '0 auto', background: 'rgba(15, 20, 35, 0.9)', boxShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', alignItems: 'center' }}>
          <h2 style={{ color: '#FFD700', margin: 0, fontSize: '2rem', textShadow: '0 0 10px rgba(241,196,15,0.5)' }}>📚 創作者儀表板</h2>
          <button onClick={() => setAdminUser(null)} style={{ padding: '0.6rem 1.2rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>登出系統</button>
        </div>
        <button className="btn-summon" onClick={handleCreateNewPack} style={{ background: 'linear-gradient(90deg, #2ecc71, #27ae60)', marginBottom: '25px', fontSize: '1.2rem', padding: '12px' }}>➕ 建立全新題庫</button>
        
        {quizPacks.length === 0 && (
           <div style={{ textAlign: 'center', padding: '2rem', color: '#7f8c8d', fontStyle: 'italic', fontSize: '1.2rem' }}>
             找不到題庫。若這是您首次使用新系統，請點擊上方按鈕建立您的第一個題庫吧！
           </div>
        )}

        <div style={{ display: 'grid', gap: '20px' }}>
          {quizPacks.map(pack => (
            <div key={pack.id} style={{ background: 'rgba(255,255,255,0.08)', padding: '20px', borderRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '8px solid #3498db', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
              <div>
                 <h3 style={{ color: '#fff', fontSize: '1.5rem', marginBottom: '8px' }}>{pack.title}</h3>
                 <p style={{ color: '#bdc3c7', fontSize: '1rem', fontWeight: 'bold' }}>包含 {pack.questions?.length || 0} 道題目</p>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn-summon" onClick={() => { setEditingPack(pack); setEditingQuestionId(null); }} style={{ padding: '10px 20px', background: 'linear-gradient(90deg, #3498db, #2980b9)', minWidth: '80px' }}>編輯</button>
                <button className="btn-summon" onClick={() => handleDeletePack(pack.id)} style={{ padding: '10px 20px', background: 'linear-gradient(90deg, #e74c3c, #c0392b)', minWidth: '80px' }}>🗑️ 刪除</button>
                <button className="btn-summon" onClick={() => handleHostGame(pack)} style={{ padding: '10px 30px', background: 'linear-gradient(90deg, #f39c12, #e67e22)', fontSize: '1.2rem', marginLeft: '10px' }}>🚀 啟動遊戲</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <style>{`
        /* 👇 核彈級強制覆蓋 👇 */
        html, body, #root {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          height: 100% !important;
          min-height: 100vh !important;
          overflow-x: hidden !important;
          background-color: #050505 !important;
        }
        
        .page-layout-wrapper {
          width: 100%;
          min-height: 100vh;
          background-size: cover, cover;
          background-position: center, center;
          background-repeat: no-repeat, no-repeat;
          background-attachment: fixed, fixed;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 2vh; 
          padding-bottom: 2vh; 
          font-family: "Noto Sans TC", sans-serif;
          transition: background-image 0.5s ease-in-out;
          background-color: #050505;
        }

        @media (max-width: 768px) {
          .page-layout-wrapper {
            background-size: cover, contain !important;
            background-position: center, top center !important;
          }
          .title-wrapper {
            margin-top: 22vh !important;
          }
          .login-panel {
            margin-top: 2vh !important;
          }
        }

        .admin-mega-panel {
          max-width: 1400px !important;
          width: 95% !important;
        }

        select.game-input {
          appearance: auto !important;
          -webkit-appearance: auto !important;
          -moz-appearance: auto !important;
          background-color: rgba(0, 0, 0, 0.8) !important;
          color: #FFD700 !important;
          cursor: pointer;
        }
        select.game-input option {
          background-color: #111 !important;
          color: #FFF !important;
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <BrowserRouter><Routes><Route path="/" element={<PlayerApp />} /><Route path="/admin" element={<AdminApp />} /></Routes></BrowserRouter>
    </ErrorBoundary>
  );
}
