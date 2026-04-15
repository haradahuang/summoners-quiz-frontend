import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('https://swtest-pgq8.onrender.com'); // ⚠️ 記得替換成你的 Render 網址

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
            width: clamp(280px, 92%, 400px);
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
        
        {!isJoined && (
          <div className="game-panel">
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#FFD700', cursor: 'pointer', fontWeight: 'bold', marginBottom: '1.2rem', fontSize: '1rem' }}>
              <input type="checkbox" checked={isHost} onChange={(e) => setIsHost(e.target.checked)} style={{ width: '1.1rem', height: '1.1rem' }} /> 
              👑 主持人管理模式
            </label>
            <input type="text" placeholder="房間代碼" value={pin} onChange={(e) => setPin(e.target.value)} className="game-input" />
            <input type="text" placeholder="您的暱稱" value={username} onChange={(e) => setUsername(e.target.value)} className="game-input" />
            <button className="btn-summon" onClick={handleJoinArena}>進入競技場</button>
          </div>
        )}

        {isJoined && !currentQuestion && !leaderboard && !reviewData && !podiumData && (
          <div className="game-panel" style={{ maxWidth: '450px' }}>
            <h2 style={{ color: '#FFD700', fontSize: '1.8rem', marginBottom: '1.2rem' }}>房號: {pin}</h2>
            {isHost ? (
              <button className="btn-summon" onClick={handleSendQuestion}>▶️ 開啟試煉</button>
            ) : (
              <p style={{ fontSize: '1.4rem', color: '#3498db', animation: 'pulse 1.5s infinite' }}>等待大師開啟試煉...</p>
            )}
            <div style={{ marginTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
              <p style={{ color: '#bdc3c7', marginBottom: '0.8rem', fontSize: '0.9rem' }}>已進場召喚師: {players.length}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'center' }}>
                {players.map((p, i) => <span key={i} style={{ background: 'rgba(255,215,0,0.1)', padding: '0.3rem 0.7rem', borderRadius: '6px', fontSize: '0.8rem', color: '#FFD700', border: '1px solid rgba(255,215,0,0.2)' }}>{p}</span>)}
              </div>
            </div>
          </div>
        )}

        {isJoined && currentQuestion && !leaderboard && !reviewData && !podiumData && (
          <div className="game-panel" style={{ maxWidth: '700px', width: '95%' }}>
            <h2 style={{ fontSize: 'clamp(1.2rem, 4vw, 1.6rem)', marginBottom: '1.5rem' }}>{currentQuestion.text}</h2>
            <div style={{ width: '100%', height: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '5px', overflow: 'hidden', marginBottom: '2rem' }}>
              <div style={{ height: '100%', background: timeLeft <= 3 ? '#e74c3c' : '#2ecc71', width: `${(timeLeft / currentQuestion.timeLimit) * 100}%`, transition: 'width 1s linear' }} />
            </div>
            {!hasAnswered && !isHost ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {currentQuestion.options.map((opt: any) => (
                  <button key={opt.id} onClick={() => handleAnswerClick(opt.id)} style={{ padding: '1rem', fontSize: '1.1rem', color: '#fff', background: 'rgba(255,255,255,0.06)', borderRadius: '10px', border: 'none', borderLeft: `6px solid ${opt.color}`, cursor: 'pointer' }}>{opt.text}</button>
                ))}
              </div>
            ) : isHost ? (
              <button className="btn-summon" onClick={handleShowLeaderboard} style={{ background: 'linear-gradient(180deg, #9b59b6 0%, #8e44ad 100%)' }}>📊 結算當前排名</button>
            ) : (
              <h3 style={{ fontSize: '2rem', color: answerResult?.isCorrect ? '#2ecc71' : '#e74c3c' }}>
                {answerResult ? (answerResult.isCorrect ? `✨ +${answerResult.earnedScore}` : 'FAILED') : 'WAITING...'}
              </h3>
            )}
          </div>
        )}

        {isJoined && leaderboard && (
           <div className="game-panel">
           <h2 style={{ color: '#FFD700', fontSize: '2.2rem', marginBottom: '1.5rem' }}>🏆 榮譽殿堂</h2>
           {leaderboard.map((player: any, index: number) => (
             <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem', borderRadius: '10px', borderLeft: index === 0 ? '5px solid #FFD700' : '5px solid #444', fontSize: '1.2rem' }}>
               <span>#{index + 1} {player.username}</span>
               <span style={{ color: '#FFD700', fontWeight: 'bold' }}>{player.score}</span>
             </div>
           ))}
           {isHost && <button className="btn-summon" onClick={handleShowReview} style={{ marginTop: '1.5rem', background: 'linear-gradient(180deg, #2980b9 0%, #2c3e50 100%)' }}>🔍 檢視戰報</button>}
         </div>
        )}

        {isJoined && reviewData && (
          <div className="game-panel" style={{ maxWidth: '550px' }}>
            <h2 style={{ color: '#3498db', fontSize: '1.8rem', marginBottom: '1.5rem' }}>數據復盤</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {reviewData.question.options.map((opt: any) => {
                const isCorrect = opt.id === reviewData.question.correctAnswer;
                const count = reviewData.stats[opt.id] || 0;
                return (
                  <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: isCorrect ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.05)', border: isCorrect ? '2px solid #2ecc71' : '1px solid #444', borderRadius: '8px' }}>
                    <span style={{ fontSize: '1.1rem', color: isCorrect ? '#2ecc71' : '#fff', textAlign: 'left' }}>{isCorrect && '✔️ '} {opt.text}</span>
                    <span style={{ fontSize: '1.1rem', color: '#bdc3c7' }}>{count} 人</span>
                  </div>
                );
              })}
            </div>
            {isHost && <button className="btn-summon" onClick={handleShowPodium} style={{ marginTop: '1.5rem', background: 'linear-gradient(180deg, #f1c40f 0%, #f39c12 100%)' }}>🏆 揭曉最終榮耀</button>}
          </div>
        )}

        {isJoined && podiumData && (
          <div className="game-panel" style={{ maxWidth: '600px', width: '95%' }}>
            <h2 style={{ color: '#FFD700', fontSize: '2.2rem', marginBottom: '2rem' }}>傳奇誕生</h2>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '0.5rem', height: '160px' }}>
              {podiumData[1] && (
                <div style={{ width: '30%' }}>
                  <div style={{ background: '#bdc3c7', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 'bold', color: '#000', borderRadius: '8px 8px 0 0' }}>2</div>
                  <p style={{fontSize: '0.9rem', marginTop: '8px'}}>{podiumData[1].username}</p>
                </div>
              )}
              {podiumData[0] && (
                <div style={{ width: '40%' }}>
                  <div style={{ background: '#f1c40f', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8rem', fontWeight: 'bold', color: '#000', borderRadius: '10px 10px 0 0', boxShadow: '0 0 20px #FFD700' }}>1</div>
                  <p style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '8px' }}>{podiumData[0].username}</p>
                </div>
              )}
              {podiumData[2] && (
                <div style={{ width: '30%' }}>
                  <div style={{ background: '#e67e22', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: '#000', borderRadius: '8px 8px 0 0' }}>3</div>
                  <p style={{fontSize: '0.9rem', marginTop: '8px'}}>{podiumData[2].username}</p>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;