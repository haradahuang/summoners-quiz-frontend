import { createClient } from '@supabase/supabase-js';

// 🌐 Supabase 憑證設定
const RAW_SUPABASE_URL = 'https://kxungtkticxfnqmbdzlq.supabase.co/rest/v1/'; 
const SUPABASE_ANON_KEY = 'sb_publishable_1J5xq2_aA5M1TJNk3CADAw_sFIuJ5Q7'; 

const CLEAN_SUPABASE_URL = RAW_SUPABASE_URL.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
export const supabase = createClient(CLEAN_SUPABASE_URL, SUPABASE_ANON_KEY);

// 🎵 全域音效引擎
export const sfx: Record<string, HTMLAudioElement> = {
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

export const unlockAudio = () => {
  const originalVolumes: Record<string, number> = { bgm: 0.3, tick: 0.6, correct: 0.8, wrong: 0.8, victory: 0.5, cheer: 0.8 };
  Object.keys(sfx).forEach(key => {
    const audio = sfx[key]; audio.volume = 0.01; 
    audio.play().then(() => { audio.pause(); audio.currentTime = 0; audio.volume = originalVolumes[key]; }).catch(() => {});
  });
  setTimeout(() => { sfx.bgm.volume = 0.3; sfx.bgm.play().catch(()=>{}); }, 100);
};

// 🎨 全域常數設定
export const topColors: Record<string, string> = { 'T1': '#e74c3c', 'T2': '#3498db', 'T3': '#f1c40f', 'T4': '#9b59b6' };
export const qTypeLabels: Record<string, string> = { choice: '單選題', match: '圖片配對題', tf: '是非題', multi: '多選題', guess: '漸進猜圖題', order: '順序排列題', img_choice: '看圖單選題' };
export const qTypeColors: Record<string, string> = { choice: '#3498db', match: '#9b59b6', tf: '#e67e22', multi: '#2ecc71', guess: '#e84393', order: '#f39c12', img_choice: '#1abc9c' };

export const DEFAULT_TITLE = '瞬答 FlashQuiz';
export const DEFAULT_BG = '/flashquiz.jpg';
