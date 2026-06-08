import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components';
import PlayerApp from './pages/PlayerApp';
import AdminApp from './pages/AdminApp';
import './index.css';

export default function App() {
  return (
    <ErrorBoundary>
      <style>{`
        html, body, #root { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; min-height: 100vh !important; overflow-x: hidden !important; background-color: #050505 !important; }
        .page-layout-wrapper { width: 100%; min-height: 100vh; background-size: cover, cover; background-position: center, center; background-repeat: no-repeat, no-repeat; background-attachment: fixed, fixed; display: flex; flex-direction: column; align-items: center; padding-top: 2vh; padding-bottom: 2vh; font-family: "Noto Sans TC", sans-serif; transition: background-image 0.5s ease-in-out; background-color: #050505; }
        
        /* 💡 修改點 3：將原本異常的 22vh 縮減至 10vh，讓手機版內容完美上推，不再需要往下滑動 */
        @media (max-width: 768px) { 
          .page-layout-wrapper { background-size: cover, contain !important; background-position: center, top center !important; } 
          .title-wrapper { margin-top: 10vh !important; } 
          .login-panel { margin-top: 2vh !important; } 
        }
        
        .admin-mega-panel { max-width: 1400px !important; width: 95% !important; }
        select.game-input { appearance: auto !important; -webkit-appearance: auto !important; -moz-appearance: auto !important; background-color: rgba(0, 0, 0, 0.8) !important; color: #FFD700 !important; cursor: pointer; }
        select.game-input option { background-color: #111 !important; color: #FFF !important; }
        .btn-copy { background: rgba(52, 152, 219, 0.15); border: 2px solid #3498db; color: #3498db; padding: 10px 25px; border-radius: 10px; font-size: 1.4rem; font-weight: bold; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); outline: none; }
        .btn-copy:hover { background: rgba(52, 152, 219, 0.8); color: #fff; box-shadow: 0 0 15px rgba(52, 152, 219, 0.6); transform: translateY(-2px); }
        .btn-copy:active { transform: translateY(1px); }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.05); opacity: 0.85; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes bounceIn { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PlayerApp />} />
          <Route path="/admin" element={<AdminApp />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
