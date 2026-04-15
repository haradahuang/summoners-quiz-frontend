import { useState, useEffect } from 'react'; // 修正：移除了沒有使用到的 React
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('https://你的render網址.onrender.com'); // ⚠️ 記得替換成你的 Render 網址

function App() {
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

  useEffect(() => {
    socket.on('player_joined', (data) => { if (!data.isHost) setPlayers((prev) => [...prev, data.username]); });
    socket.on('receive_question', (q) => { setCurrentQuestion(q); setTimeLeft(q.timeLimit); setHasAnswered(false); setAnswerResult(null); setLeaderboard(null); setReviewData(null); setPodiumData(null); });
    socket.on('answer_result', setAnswerResult);
    socket.on('leaderboard_updated', (top5) => { setLeaderboard(top5); setReviewData(null); setPodiumData(null); });
    socket.on('review_updated', (data) => { setReviewData(data); setLeaderboard(null); setPodiumData(null); });
    socket.on('podium_updated', (top3) => { setPodiumData(top3); setReviewData(null); setLeaderboard(null); setCurrentQuestion(null); });

    return () => { socket.off('player_joined'); socket.off('receive_question'); socket.off('answer_result'); socket.off('leaderboard_updated'); socket.off('review_updated'); socket.off('podium_updated'); };
  }, []);

  useEffect(() => {
    if (currentQuestion && timeLeft > 0 && !hasAnswered && !leaderboard && !reviewData && !podiumData) {
      const timerId = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timerId);
    } else if (timeLeft === 0 && currentQuestion && !hasAnswered && !isHost) {
      setHasAnswered(true);
    }
  }, [currentQuestion, timeLeft, hasAnswered, isHost, leaderboard, reviewData, podiumData]);

  const handleJoinArena = () => { if (username.trim() && pin.trim()) { socket.emit('join_room', { pin, username, isHost }); setIsJoined(true); } };
  const handleSendQuestion = () => socket.emit('host_send_question', pin);
  const handleAnswerClick = (answerId: string) => { if (!hasAnswered) { setHasAnswered(true); socket.emit('submit_answer', { pin, answerId }); } };
  const handleShowLeaderboard = () => socket.emit('host_show_leaderboard', pin);
  const handleShowReview = () => socket.emit('host_show_review', pin);
  const handleShowPodium = () => socket.emit('host_show_podium', pin);

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
      display: 'flex', flexDirection: 'column', 
      justifyContent: 'flex-start', 
      alignItems: 'center', 
      paddingTop: '12vh', 
      fontFamily: '"Noto Sans TC", sans-serif',
      background: `radial-gradient(circle at center, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.88) 90%), url("https://event-fn.qpyou.cn/event/brand/smon_v2/event/12th_anniversary/assets/summonerswar_12anniv_2.jpg")`,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'
    }}>
      
      <style>
        {`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body, html, #root { width: 100%; height: 100%; overflow: hidden; background: #000; }

          .game-panel {
            background: rgba(18, 22, 35, 0.92); 
            backdrop-filter: blur(25px); 
            border: 1px solid rgba(255, 215, 0, 0.4); 
            border-radius: 20px;
            box-shadow: 0 15px 45px rgba(0,0,0,0.9);
            padding: clamp(1.2rem, 4vh, 2rem); 
            color: #fff;
            width: clamp(280px, 92%, 450px);
            text-align: center;
            margin-top: 10px;
          }

          .game-input {
            width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.75);
            border: 1px solid #4a5568; border-radius: 8px; color: #fff;
            font-size: 1.05rem; outline: none; margin-bottom: 0.7rem;
            text-align: center;
          }

          .btn-summon {
            width: 100%; padding: 0.9rem; font-size: 1.25rem; font-weight: 900;
            background: linear-gradient(180deg, #ffb347 0%, #ff7b00 100%);
            color: #fff; border: 1.5px solid #fff; border-radius: 10px; cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
          }

          .text-glow {
            background: linear-gradient(to bottom, #FFD700 30%, #f39c12 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: 900;
            font-size: clamp(2.2rem, 7vw, 3.2rem); 
            filter: drop-shadow(0 0 2px #000) drop-shadow(0 0 8px rgba(0,0,0,0.8)); 
            letter-spacing: 3px;
            margin-bottom: 5px;
            padding: 10px 0;
            line-height: 1.2;
          }

          @media (max-height: 750px) {
            .game-panel { padding: 1rem 1.5rem; }
            .text-glow { font-size: 2rem; }
          }
        `}
      </style>

      {/* 標題區 */}
      <div style={{ textAlign: 'center', zIndex: 10 }}>
        <h1 className="text-glow">傳奇金頭腦挑戰賽</h1>
      </div>

      {/* 主要內容區 */}
      <div style={{ padding: '0 10px', width: '100%', display: 'flex', justifyContent: 'center', zIndex: 10 }}>
        
        {/* 登入畫面 */}
        {!isJoined && (
          <div className="game-panel">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '