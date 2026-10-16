/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  translations,
  alertTranslations,
  SUPPORTED_LANGUAGES,
  LangCode,
} from './translations';

export type PlatformType = '1xbet' | 'melbet' | 'spinbetter';

export interface PlatformConfig {
  id: PlatformType;
  name: string;
  logo: string;
  url: string;
  color: string;
  badgeClass: string;
}

export const PLATFORMS_DATA: Record<PlatformType, PlatformConfig> = {
  '1xbet': {
    id: '1xbet',
    name: '1xBet',
    logo: '/img/1xbet.png',
    url: 'https://reffpa.com/L?tag=d_5911874m_97c_&site=5911874&ad=97',
    color: '#038DED',
    badgeClass: 'btn-1x',
  },
  'melbet': {
    id: 'melbet',
    name: 'MELBET',
    logo: '/img/melbet.svg',
    url: 'https://melbet.com',
    color: '#FFC800',
    badgeClass: 'btn-melbet',
  },
  'spinbetter': {
    id: 'spinbetter',
    name: 'SpinBetter',
    logo: '/img/spinbetter.svg',
    url: 'https://spinbetter.com',
    color: '#00ffd0',
    badgeClass: 'btn-spinbetter',
  },
};

export const PROMO_CODE = 'MXG1';

interface SessionData {
  userId: string;
  expiry: number;
  platform: PlatformType;
}

interface PredictionItem {
  id: number;
  multiplier: number;
  safeCashout: number;
  confidence: number;
  time: string;
  isHit: boolean;
}

export default function App() {
  // Splash screen state
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Language state
  const [currentLang, setCurrentLang] = useState<LangCode>('ar');
  const [langMenuOpen, setLangMenuOpen] = useState<boolean>(false);

  // Sound enabled
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Active view: 'loginView' | 'affiliateView' | 'dashboardView'
  const [activeView, setActiveView] = useState<'loginView' | 'affiliateView' | 'dashboardView'>('loginView');

  // Top header date and time
  const [dateTime, setDateTime] = useState({
    time: '00:00:00',
    day: '',
    date: '0000/00/00',
  });

  // Modals & Overlays
  const [showLoadingOverlay, setShowLoadingOverlay] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [showVideoModal, setShowVideoModal] = useState<boolean>(false);

  // Login form state
  const [loginUserId, setLoginUserId] = useState<string>('');
  const [loginActCode, setLoginActCode] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');

  // Affiliate / verification form state
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>('1xbet');
  const [verifyId, setVerifyId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');

  // Dashboard state
  const [session, setSession] = useState<SessionData | null>(null);
  const [timerText, setTimerText] = useState<string>('00:00:00');
  const [timerPercent, setTimerPercent] = useState<number>(100);

  // Copy button feedback states
  const [promoCopied, setPromoCopied] = useState<boolean>(false);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);

  // ===================== CRASH PREDICTION ENGINE STATE =====================
  const [roundNumber, setRoundNumber] = useState<number>(849312);
  const [predictionState, setPredictionState] = useState<'IDLE' | 'ANALYZING' | 'LOCKED' | 'FLYING' | 'HIT'>('IDLE');
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.00);
  const [targetMultiplier, setTargetMultiplier] = useState<number>(2.48);
  const [safeCashout, setSafeCashout] = useState<number>(2.05);
  const [confidence, setConfidence] = useState<number>(99.2);
  const [autoPredict, setAutoPredict] = useState<boolean>(true);
  const [recentPredictions, setRecentPredictions] = useState<PredictionItem[]>([
    { id: 849311, multiplier: 2.74, safeCashout: 2.25, confidence: 99.4, time: 'منذ دقيقة', isHit: true },
    { id: 849310, multiplier: 1.88, safeCashout: 1.55, confidence: 98.9, time: 'منذ دقيقتين', isHit: true },
    { id: 849309, multiplier: 3.42, safeCashout: 2.80, confidence: 99.1, time: 'منذ 3 دقائق', isHit: true },
    { id: 849308, multiplier: 1.65, safeCashout: 1.40, confidence: 99.6, time: 'منذ 4 دقائق', isHit: true },
    { id: 849307, multiplier: 4.80, safeCashout: 3.90, confidence: 98.6, time: 'منذ 5 دقائق', isHit: true },
  ]);

  // Canvas & timer refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const flightIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nextRoundTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animSpeedRef = useRef<number>(1.0);

  // Translation helpers
  const t = (key: string, fallback = ''): string => {
    const langObj = (translations as Record<string, Record<string, any>>)[currentLang];
    return (langObj && langObj[key] !== undefined) ? langObj[key] : fallback;
  };

  const alertT = (key: string, fallback = ''): string => {
    const aObj = (alertTranslations as Record<string, Record<string, string>>)[currentLang] || alertTranslations['ar'];
    return (aObj && aObj[key] !== undefined) ? aObj[key] : fallback;
  };

  const currentLangConfig = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];
  const activePlatformConfig = PLATFORMS_DATA[session?.platform || selectedPlatform] || PLATFORMS_DATA['1xbet'];

  // Web Audio Synth Bip
  const playBeep = (freq = 880, duration = 0.15, type: OscillatorType = 'sine') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // ignore
    }
  };

  // Play success chime
  const playSuccessChime = () => {
    if (!soundEnabled) return;
    try {
      playBeep(523.25, 0.1, 'triangle'); // C5
      setTimeout(() => playBeep(659.25, 0.12, 'triangle'), 100); // E5
      setTimeout(() => playBeep(783.99, 0.25, 'sine'), 220); // G5
    } catch {
      // ignore
    }
  };

  // Auto-detect language & check login on mount
  useEffect(() => {
    const saved = localStorage.getItem('site_lang') as LangCode | null;
    if (saved && (translations as Record<string, any>)[saved]) {
      handleSetLanguage(saved);
    } else {
      const browserLang = navigator.language.slice(0, 2) as LangCode;
      if ((translations as Record<string, any>)[browserLang]) {
        handleSetLanguage(browserLang);
      } else {
        handleSetLanguage('ar');
      }
    }

    // Splash timeout (1.8 seconds)
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 1800);

    // Check if previously logged in
    try {
      const storedSession = localStorage.getItem('loggedIn');
      if (storedSession) {
        const parsed = JSON.parse(storedSession) as SessionData;
        if (parsed && parsed.expiry && Date.now() < parsed.expiry) {
          setSession(parsed);
          if (parsed.platform && PLATFORMS_DATA[parsed.platform]) {
            setSelectedPlatform(parsed.platform);
          }
          setActiveView('dashboardView');
        }
      }
    } catch {
      // ignore
    }

    return () => {
      clearTimeout(splashTimer);
    };
  }, []);

  // Update clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');

      const y = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');

      const daysArr = (translations as Record<string, any>)[currentLang]?.days || translations['ar'].days;
      const dayName = daysArr[now.getDay()] || '';

      setDateTime({
        time: `${h}:${m}:${s}`,
        day: dayName,
        date: `${y}/${month}/${d}`,
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [currentLang]);

  // Set Language handler
  const handleSetLanguage = (code: LangCode) => {
    setCurrentLang(code);
    localStorage.setItem('site_lang', code);
    const cfg = SUPPORTED_LANGUAGES.find((l) => l.code === code) || SUPPORTED_LANGUAGES[0];
    document.documentElement.dir = cfg.dir;
    document.documentElement.lang = cfg.code;
    setLangMenuOpen(false);
  };

  // Switch View
  const switchView = (view: 'loginView' | 'affiliateView' | 'dashboardView') => {
    setLoginError('');
    if (view !== 'dashboardView') {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (flightIntervalRef.current) clearInterval(flightIntervalRef.current);
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    }
    setActiveView(view);
  };

  // ===================== GENERATE REALISTIC CRASH PREDICTION =====================
  const generateNewPrediction = useCallback((customTarget?: number) => {
    if (flightIntervalRef.current) clearInterval(flightIntervalRef.current);
    if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);

    setPredictionState('ANALYZING');
    animSpeedRef.current = 3.5;
    playBeep(440, 0.08, 'sawtooth');

    // Simulate SHA-256 analysis delay (1.2s)
    setTimeout(() => {
      let target = customTarget;
      if (!target) {
        const rand = Math.random();
        if (rand < 0.55) {
          target = Number((1.45 + Math.random() * 1.15).toFixed(2));
        } else if (rand < 0.82) {
          target = Number((2.61 + Math.random() * 1.79).toFixed(2));
        } else if (rand < 0.95) {
          target = Number((4.41 + Math.random() * 4.09).toFixed(2));
        } else {
          target = Number((8.51 + Math.random() * 9.49).toFixed(2));
        }
      }

      const safe = Number(Math.max(1.20, target * 0.82).toFixed(2));
      const conf = Number((98.5 + Math.random() * 1.3).toFixed(1));
      const newRound = roundNumber + 1;

      setRoundNumber(newRound);
      setTargetMultiplier(target);
      setSafeCashout(safe);
      setConfidence(conf);
      setPredictionState('LOCKED');
      setCurrentMultiplier(target);
      animSpeedRef.current = 1.2;

      playSuccessChime();

      setTimeout(() => {
        startLiveFlight(target, safe, conf, newRound);
      }, 2500);
    }, 1200);
  }, [roundNumber]);

  // Live round flight simulation
  const startLiveFlight = (target: number, safe: number, conf: number, roundId: number) => {
    setPredictionState('FLYING');
    let mult = 1.00;
    setCurrentMultiplier(1.00);
    animSpeedRef.current = 2.0;

    const stepMs = 50;
    const increment = Math.max(0.02, (target - 1.00) / (40 + target * 8));

    flightIntervalRef.current = setInterval(() => {
      mult += increment;
      if (mult >= target) {
        mult = target;
        clearInterval(flightIntervalRef.current!);
        setCurrentMultiplier(target);
        setPredictionState('HIT');
        animSpeedRef.current = 1.0;
        playSuccessChime();

        setRecentPredictions((prev) => [
          {
            id: roundId,
            multiplier: target,
            safeCashout: safe,
            confidence: conf,
            time: 'الآن',
            isHit: true,
          },
          ...prev.slice(0, 7),
        ]);

        if (autoPredict) {
          nextRoundTimeoutRef.current = setTimeout(() => {
            generateNewPrediction();
          }, 4000);
        }
      } else {
        setCurrentMultiplier(Number(mult.toFixed(2)));
      }
    }, stepMs);
  };

  // Dashboard initialization
  useEffect(() => {
    if (activeView !== 'dashboardView') return;

    const currentSession = session || (JSON.parse(localStorage.getItem('loggedIn') || 'null') as SessionData | null);
    if (!currentSession || Date.now() > currentSession.expiry) {
      logout();
      return;
    }

    setSession(currentSession);

    // Start session countdown timer
    const totalDuration = currentSession.expiry - Date.now();
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((currentSession.expiry - Date.now()) / 1000));
      const h = Math.floor(remaining / 3600);
      const m = Math.floor((remaining % 3600) / 60);
      const s = remaining % 60;
      setTimerText(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      setTimerPercent((remaining / Math.max(1, totalDuration / 1000)) * 100);

      if (remaining <= 0) {
        logout();
      }
    };

    updateCountdown();
    countdownIntervalRef.current = setInterval(updateCountdown, 1000);

    const initTimer = setTimeout(() => {
      generateNewPrediction(2.48);
    }, 600);

    // Initialize Canvas Orbit
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        let w = (canvas.width = canvas.offsetWidth || 280);
        let h = (canvas.height = canvas.offsetHeight || 280);

        const handleResize = () => {
          if (canvas) {
            w = canvas.width = canvas.offsetWidth;
            h = canvas.height = canvas.offsetHeight;
          }
        };
        window.addEventListener('resize', handleResize);

        let animFrac = 0;
        const particles: any[] = [];

        class Particle {
          x = 0;
          y = 0;
          vx = 0;
          vy = 0;
          life = 0;
          maxLife = 1;
          size = 1;

          constructor() {
            this.reset(true);
          }

          reset(initial = false) {
            const angle = Math.random() * Math.PI * 2;
            const maxR = Math.min(w, h) * 0.44;
            const minR = maxR * 0.75;
            const radius = initial ? Math.random() * (maxR - minR) + minR : minR + Math.random() * 15;
            this.x = w / 2 + Math.cos(angle) * radius;
            this.y = h / 2 + Math.sin(angle) * radius;
            const speed = 0.25 + Math.random() * 0.6;
            this.vx = -Math.sin(angle) * speed;
            this.vy = Math.cos(angle) * speed;
            this.life = 0.6 + Math.random() * 1.2;
            this.maxLife = this.life;
            this.size = 0.8 + Math.random() * 2.5;
          }

          update() {
            const speedMul = animSpeedRef.current;
            this.x += this.vx * speedMul;
            this.y += this.vy * speedMul;
            this.life -= 0.005 * speedMul;
            if (this.life <= 0) this.reset();
          }

          draw(ctx: CanvasRenderingContext2D) {
            const alpha = this.life / this.maxLife;
            ctx.fillStyle = `rgba(0,255,204,${alpha * 0.9})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        for (let i = 0; i < 85; i++) particles.push(new Particle());

        const draw = () => {
          ctx.clearRect(0, 0, w, h);
          const cx = w / 2;
          const cy = h / 2;
          const maxR = Math.min(w, h) * 0.46;

          const radGrad = ctx.createRadialGradient(cx, cy, maxR * 0.25, cx, cy, maxR * 1.15);
          radGrad.addColorStop(0, 'rgba(0,255,204,0.16)');
          radGrad.addColorStop(0.5, 'rgba(0,255,204,0.05)');
          radGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = radGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, maxR * 1.15, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#00ffcc';
          for (let i = 0; i < 40; i++) {
            const a = (i / 40) * Math.PI * 2 + animFrac * 2;
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * maxR * 0.96, cy + Math.sin(a) * maxR * 0.96, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.shadowColor = '#00ffcc';
          ctx.shadowBlur = 14;
          ctx.strokeStyle = '#00ffcc';
          ctx.lineWidth = 2.8;

          ctx.setLineDash([5, 7]);
          ctx.lineDashOffset = animFrac * 120;
          ctx.beginPath();
          ctx.arc(cx, cy, maxR * 0.88, 0, Math.PI * 2);
          ctx.stroke();

          ctx.setLineDash([3, 5]);
          ctx.lineDashOffset = -animFrac * 90;
          ctx.beginPath();
          ctx.arc(cx, cy, maxR * 0.72, 0, Math.PI * 2);
          ctx.stroke();

          ctx.setLineDash([2, 4]);
          ctx.lineDashOffset = animFrac * 65;
          ctx.beginPath();
          ctx.arc(cx, cy, maxR * 0.52, 0, Math.PI * 2);
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.setLineDash([]);

          for (const p of particles) {
            p.update();
            p.draw(ctx);
          }

          animFrac += 0.004 * animSpeedRef.current;
          animFrameRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
          window.removeEventListener('resize', handleResize);
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          clearTimeout(initTimer);
        };
      }
    }

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (flightIntervalRef.current) clearInterval(flightIntervalRef.current);
      if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    };
  }, [activeView, generateNewPrediction]);

  // Logout
  const logout = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (flightIntervalRef.current) clearInterval(flightIntervalRef.current);
    if (nextRoundTimeoutRef.current) clearTimeout(nextRoundTimeoutRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    localStorage.removeItem('loggedIn');
    setSession(null);
    switchView('loginView');
  };

  // Switch Active Platform in Dashboard
  const handleSwitchPlatformInDash = (plat: PlatformType) => {
    setSelectedPlatform(plat);
    if (session) {
      const updated: SessionData = { ...session, platform: plat };
      localStorage.setItem('loggedIn', JSON.stringify(updated));
      setSession(updated);
    }
  };

  // Login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const uid = loginUserId.trim();
    const code = loginActCode.trim().toUpperCase();

    if (!uid || !code) {
      setLoginError(t('err_empty', '⚠️ يرجى إدخال رقم الـ ID وكود التفعيل أولاً!'));
      return;
    }

    if (uid.length < 10 || parseInt(uid, 10) < 1600000000) {
      setLoginError(t('err_id', '⚠️ رقم id غير مسجل، يجب اتباع خطوات.'));
      return;
    }

    const storedStr = localStorage.getItem('generatedCode');
    const stored = storedStr ? JSON.parse(storedStr) : null;

    // Validate code from local storage OR promo-linked standard activation codes
    const isStoredMatch =
      stored &&
      stored.userId === uid &&
      stored.code.toUpperCase() === code &&
      Date.now() < stored.expiry;

    const isFormatValid =
      code.startsWith('THANOS') ||
      code.startsWith('WINDOWS') ||
      code.startsWith('1X') ||
      code.startsWith('MEGA') ||
      code.startsWith('CRASH') ||
      code.startsWith('MXG1');

    if (isStoredMatch || isFormatValid) {
      const platformToUse = (stored && stored.platform) ? stored.platform : selectedPlatform;
      const sess: SessionData = {
        userId: uid,
        expiry: stored?.expiry || Date.now() + 3600000 * 3,
        platform: platformToUse,
      };
      localStorage.setItem('loggedIn', JSON.stringify(sess));
      setSession(sess);
      setLoginError('');
      switchView('dashboardView');
    } else {
      setLoginError(t('dash_error_login', '❌ بيانات الدخول غير صحيحة أو انتهت صلاحية الكود.'));
    }
  };

  // Quick Login
  const handleQuickLogin = () => {
    const storedStr = localStorage.getItem('generatedCode');
    if (storedStr) {
      const stored = JSON.parse(storedStr);
      setShowSuccessModal(false);
      switchView('loginView');
      setLoginUserId(stored.userId);
      setLoginActCode(stored.code);
    }
  };

  // Copy Promo Code
  const handleCopyPromo = (promo: string) => {
    navigator.clipboard.writeText(promo);
    setPromoCopied(true);
    setTimeout(() => setPromoCopied(false), 2000);
  };

  // Copy Assigned Code
  const handleCopyAssignedCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  // Start Verification
  const isVerifyEnabled =
    verifyId.length === 10 && parseInt(verifyId, 10) >= 1600000000 && !!selectedFile;

  const handleStartVerification = async () => {
    if (!isVerifyEnabled) return;

    setShowLoadingOverlay(true);
    await new Promise((r) => setTimeout(r, 1400));

    const randomCode = 'CRASH' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const codeData = {
      userId: verifyId,
      code: randomCode,
      expiry: Date.now() + 3600000 * 2, // 2 hours
      platform: selectedPlatform,
    };

    localStorage.setItem('generatedCode', JSON.stringify(codeData));
    setGeneratedCode(randomCode);
    setShowLoadingOverlay(false);
    setShowSuccessModal(true);
  };

  // ID validation badge icon for verify view
  const getVerifyIdStatus = () => {
    if (!verifyId) return 'empty';
    if (verifyId.length < 10 || parseInt(verifyId, 10) < 1600000000) return 'invalid';
    return 'valid';
  };
  const verifyStatus = getVerifyIdStatus();

  return (
    <>
      {/* 1. Initial Splash Loader */}
      {showSplash && (
        <div
          className="initial-splash"
          onClick={() => setShowSplash(false)}
          title="انقر للمتابعة الفورية"
        >
          <img
            src="/img/icon.png"
            alt="THANOS"
            className="logo-icon"
            style={{ width: '100px', height: '100px', objectFit: 'contain' }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <h2 style={{ fontFamily: 'sans-serif', color: '#00ffcc', letterSpacing: '2px', marginTop: '10px' }}>
            THANOS
          </h2>
          <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '4px', marginTop: '20px' }}></div>
        </div>
      )}

      {/* 2. Top Header (Real-time Clock, Language Selector & Sound Toggle) */}
      <div className="top-header">
        <div className="header-datetime">
          <span className="time-text">{dateTime.time}</span> |{' '}
          <span className="day-text">{dateTime.day}</span> -{' '}
          <span className="date-text">{dateTime.date}</span>
        </div>

        <div className="header-actions">
          {/* Audio Mute/Unmute */}
          <button
            type="button"
            className="sound-toggle-btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'كتم الصوت' : 'تفعيل الصوت'}
          >
            <i className={`fas ${soundEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
          </button>

          {/* Language Menu Dropdown */}
          <div className={`lang-menu ${langMenuOpen ? 'active' : ''}`} id="langMenu">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <div
                key={lang.code}
                onClick={() => handleSetLanguage(lang.code)}
              >
                {lang.flag} {lang.name}
              </div>
            ))}
          </div>

          {/* Current Language Trigger */}
          <div className="lang-switcher" onClick={() => setLangMenuOpen(!langMenuOpen)}>
            <span id="current-lang-icon">{currentLangConfig.flag}</span>{' '}
            <span id="current-lang-name">{currentLangConfig.name}</span>
          </div>
        </div>
      </div>

      {/* 3. Background Animated Rising Circles */}
      <div className="bg-circles">
        <div></div>
        <div></div>
        <div></div>
      </div>

      {/* 4. Main Glass Container */}
      <div className="glass-panel" style={{ maxWidth: '420px' }}>
        {/* ===================== VIEW 1: LOGIN VIEW ===================== */}
        {activeView === 'loginView' && (
          <div className="view-section active" id="loginView">
            <img
              src="/img/icon.png"
              alt="THANOS"
              className="logo-icon"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <h1 className="title">
              THANOS <span>Crash</span>
            </h1>

            {loginError && (
              <div id="loginErrorBox" className="error-box">
                {loginError}
              </div>
            )}

            <form id="loginForm" onSubmit={handleLogin}>
              <div className="input-group">
                <input
                  type="tel"
                  id="loginUserId"
                  placeholder={t('id_placeholder', 'رقم الـ ID الخاص بك')}
                  autoComplete="off"
                  value={loginUserId}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                    setLoginUserId(clean);
                    setLoginError('');
                  }}
                />
                <i className="fas fa-user"></i>
              </div>

              <div className="input-group">
                <input
                  type="text"
                  id="loginActCode"
                  placeholder={t('code_placeholder', 'كود التفعيل')}
                  autoComplete="off"
                  value={loginActCode}
                  onChange={(e) => {
                    setLoginActCode(e.target.value);
                    setLoginError('');
                  }}
                />
                <i className="fas fa-key"></i>
              </div>

              <button type="submit" className="btn btn-primary lightning-btn">
                {t('login_btn', 'تسجيل الدخول')}
              </button>
            </form>

            <button
              type="button"
              className="btn btn-outline lightning-btn"
              onClick={() => switchView('affiliateView')}
            >
              {t('get_code_btn', 'احصل على كود تفعيل مجاني 🎁')}
            </button>

            <button
              type="button"
              className="btn btn-video lightning-btn"
              onClick={() => setShowVideoModal(true)}
            >
              <i className="fas fa-play-circle"></i> {t('video_btn', 'فيديو الشرح')}
            </button>
          </div>
        )}

        {/* ===================== VIEW 2: AFFILIATE / VERIFICATION VIEW ===================== */}
        {activeView === 'affiliateView' && (
          <div className="view-section active" id="affiliateView">
            <img
              src="/img/icon.png"
              alt="THANOS"
              className="logo-icon"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <h1 className="title">
              THANOS <span>Crash</span>
            </h1>

            <div className="steps-frame">
              <h3>{t('aff_title', 'خطوات التفعيل المجاني 🎁')}</h3>
              <p>
                1. قم بإنشاء حساب جديد في إحدى المنصات التالية باستخدام البرومو كود الخاص بنا:
              </p>

              {/* 3 Platforms Cards: 1xBet, MELBET, spinbetter */}
              <div className="book-links">
                <a
                  href={PLATFORMS_DATA['1xbet'].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="book-card"
                  onClick={() => setSelectedPlatform('1xbet')}
                  title="تسجيل في 1xBet"
                >
                  <img src={PLATFORMS_DATA['1xbet'].logo} alt="1xBet" />
                  <span>1xBet</span>
                  <small>سجل الآن</small>
                </a>

                <a
                  href={PLATFORMS_DATA['melbet'].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="book-card"
                  onClick={() => setSelectedPlatform('melbet')}
                  title="تسجيل في MELBET"
                >
                  <img src={PLATFORMS_DATA['melbet'].logo} alt="MELBET" />
                  <span>MELBET</span>
                  <small>سجل الآن</small>
                </a>

                <a
                  href={PLATFORMS_DATA['spinbetter'].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="book-card"
                  onClick={() => setSelectedPlatform('spinbetter')}
                  title="تسجيل في SpinBetter"
                >
                  <img src={PLATFORMS_DATA['spinbetter'].logo} alt="SpinBetter" />
                  <span>SpinBetter</span>
                  <small>سجل الآن</small>
                </a>
              </div>

              {/* Promo code box with MXG1 */}
              <div className="promo-box">
                <div>
                  <span style={{ display: 'block', fontSize: '18px', fontWeight: 900, color: '#00ffcc', letterSpacing: '2px' }}>
                    {PROMO_CODE}
                  </span>
                  <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>
                    صالح لمنصات: 1xBet | MELBET | SpinBetter
                  </div>
                </div>
                <button
                  type="button"
                  className="copy-btn lightning-btn"
                  style={{ background: promoCopied ? '#fff' : '#00ffcc' }}
                  onClick={() => handleCopyPromo(PROMO_CODE)}
                >
                  {promoCopied ? t('copied', 'تم النسخ!') : t('copy_btn', 'نسخ الكود')}
                </button>
              </div>

              <p
                dangerouslySetInnerHTML={{
                  __html: t(
                    'aff_step2',
                    '2. قم بإيداع مبلغ <span class="txt-green">15$</span> في حسابك الجديد للبدء باللعب.'
                  ),
                }}
              />
            </div>

            <div className="verify-frame">
              <h4 style={{ marginTop: 0, color: '#00ffcc' }}>
                {t('verify_title', 'تأكد من الاشتراك')}
              </h4>

              {/* 3 Platforms Selector */}
              <div style={{ fontSize: '11px', color: '#aaa', marginBottom: '6px', textAlign: 'right' }}>
                اختر المنصة المسجل بها:
              </div>
              <div className="platform-selector">
                {(['1xbet', 'melbet', 'spinbetter'] as PlatformType[]).map((platKey) => {
                  const plat = PLATFORMS_DATA[platKey];
                  const isActive = selectedPlatform === platKey;
                  return (
                    <div
                      key={platKey}
                      className={`plat-btn ${plat.badgeClass} lightning-btn ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedPlatform(platKey)}
                    >
                      <img src={plat.logo} alt={plat.name} style={{ width: '16px', height: '16px', objectFit: 'contain' }} />
                      <span>{plat.name}</span>
                    </div>
                  );
                })}
              </div>

              <div className={`input-group ${verifyStatus === 'valid' ? 'valid' : verifyStatus === 'invalid' ? 'invalid' : ''}`}>
                <input
                  type="tel"
                  id="verify-id"
                  placeholder={t('verify_id_place', 'أدخل الـ ID الخاص بك')}
                  autoComplete="off"
                  value={verifyId}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 10);
                    setVerifyId(clean);
                  }}
                />
                <i
                  className={
                    verifyStatus === 'empty'
                      ? 'fas fa-id-badge'
                      : verifyStatus === 'invalid'
                      ? 'fas fa-times-circle'
                      : 'fas fa-check-circle'
                  }
                ></i>
              </div>

              <label className="file-upload">
                <span
                  dangerouslySetInnerHTML={{
                    __html: t(
                      'upload_btn',
                      '<i class="fas fa-cloud-upload-alt"></i> ارفع صورة الإيداع و الـ ID'
                    ),
                  }}
                />
                <input
                  type="file"
                  id="file-input"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                />
                {selectedFile && <span id="file-name">📄 {selectedFile.name}</span>}
              </label>

              <button
                type="button"
                id="verify-btn"
                className={`btn-verify lightning-btn ${isVerifyEnabled ? 'enabled' : ''}`}
                onClick={handleStartVerification}
              >
                {t('verify_btn', 'تأكد من الخطوات واحصل على الكود')}
              </button>
            </div>

            <button
              type="button"
              className="btn btn-back-large lightning-btn"
              onClick={() => switchView('loginView')}
            >
              <i className="fas fa-arrow-right"></i> {t('back_btn', 'رجوع لتسجيل الدخول')}
            </button>
          </div>
        )}

        {/* ===================== VIEW 3: LIVE CRASH PREDICTOR DASHBOARD ===================== */}
        {activeView === 'dashboardView' && (
          <div className="view-section active" id="dashboardView">
            {/* Server Status Header with active platform */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '10px' }}>
              <div className="server-badge" style={{ borderColor: activePlatformConfig.color + '60' }}>
                <span className="server-dot" style={{ background: activePlatformConfig.color, boxShadow: `0 0 8px ${activePlatformConfig.color}` }}></span>
                <span>THANOS • {activePlatformConfig.name} LIVE</span>
              </div>
              <div style={{ fontSize: '11px', color: '#8899a6', fontFamily: 'monospace' }}>
                ROUND #{roundNumber}
              </div>
            </div>

            <div className="crash-wrap" style={{ gap: '14px', paddingTop: '0' }}>
              {/* Orbital Canvas with Live Multiplier Display */}
              <div className="orb-container ready" id="orbContainer" style={{ width: 'min(76vw, 260px)' }}>
                <canvas ref={canvasRef} id="orbitCanvas" width={260} height={260}></canvas>
                <div style={{ position: 'relative', zIndex: 6, textAlign: 'center' }}>
                  <div
                    className="orb-value"
                    id="crashValue"
                    style={{
                      color: predictionState === 'HIT' ? '#00e676' : predictionState === 'FLYING' ? '#ffcc00' : '#00ffcc',
                      textShadow: predictionState === 'HIT' ? '0 0 25px rgba(0, 230, 118, 0.9)' : '0 0 20px rgba(0, 255, 204, 0.8)',
                      transition: 'color 0.3s ease',
                    }}
                  >
                    {predictionState === 'ANALYZING' ? '---' : `${currentMultiplier.toFixed(2)}x`}
                  </div>

                  <div style={{ fontSize: '11px', fontWeight: 800, marginTop: '4px', letterSpacing: '1px' }}>
                    {predictionState === 'ANALYZING' && (
                      <span style={{ color: '#00aaff' }}>
                        <i className="fas fa-sync fa-spin"></i> جاري فحص خوارزمية {activePlatformConfig.name}...
                      </span>
                    )}
                    {predictionState === 'LOCKED' && (
                      <span style={{ color: '#00ffcc' }}>
                        <i className="fas fa-lock"></i> تم تثبيت التوقع المضمون!
                      </span>
                    )}
                    {predictionState === 'FLYING' && (
                      <span style={{ color: '#ffcc00' }}>
                        <i className="fas fa-rocket"></i> جولة حية قيد التصاعد
                      </span>
                    )}
                    {predictionState === 'HIT' && (
                      <span style={{ color: '#00e676' }}>
                        <i className="fas fa-check-double"></i> تم تحقيق الهدف 🎯
                      </span>
                    )}
                    {predictionState === 'IDLE' && (
                      <span style={{ color: '#aaa' }}>
                        جاهز للجولة القادمة
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Prediction Metrics Bar (Target Multiplier, Safe Cashout, Accuracy) */}
              <div className="stat-grid">
                <div className="stat-box">
                  <div className="stat-box-title">التوقع القادم</div>
                  <div className="stat-box-val" style={{ color: '#00ffcc' }}>
                    {targetMultiplier.toFixed(2)}x
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-box-title">سحب آمن موصى به</div>
                  <div className="stat-box-val" style={{ color: '#00e676' }}>
                    {safeCashout.toFixed(2)}x
                  </div>
                </div>
                <div className="stat-box">
                  <div className="stat-box-title">دقة التوقع</div>
                  <div className="stat-box-val" style={{ color: '#ffcc00' }}>
                    {confidence}%
                  </div>
                </div>
              </div>

              {/* Action Controls: Generate Next Signal + Auto-Predict Toggle */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary lightning-btn"
                  style={{ margin: 0, padding: '12px' }}
                  onClick={() => generateNewPrediction()}
                  disabled={predictionState === 'ANALYZING'}
                >
                  <i className="fas fa-bolt"></i> {predictionState === 'ANALYZING' ? 'جاري فحص السيرفر...' : 'توقع الجولة التالية فوراً ⚡'}
                </button>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 14px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>
                    <i className="fas fa-robot" style={{ color: '#00ffcc', marginLeft: '6px' }}></i> التوقع التلقائي المستمر
                  </span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={autoPredict}
                      onChange={(e) => setAutoPredict(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              {/* Prediction History Strip */}
              <div className="history-container">
                <div className="history-header">
                  <span>
                    <i className="fas fa-history" style={{ color: '#00ffcc', marginLeft: '5px' }}></i> سجل التوقعات الأخيرة
                  </span>
                  <span style={{ color: '#00e676' }}>نسبة النجاح: 99.4%</span>
                </div>
                <div className="history-chips">
                  {recentPredictions.map((pred) => {
                    const chipClass =
                      pred.multiplier >= 4.5
                        ? 'chip-high'
                        : pred.multiplier >= 2.6
                        ? 'chip-med'
                        : 'chip-safe';
                    return (
                      <div key={pred.id} className={`history-chip ${chipClass}`}>
                        <span>{pred.multiplier.toFixed(2)}x</span>
                        <i className="fas fa-check" style={{ fontSize: '10px' }}></i>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Account & Platform Info Cards */}
              <div className="info-cards" style={{ gap: '10px' }}>
                <div className="unified-card">
                  <div className="avatar-circle">
                    <i className="fas fa-fingerprint"></i>
                  </div>
                  <div className="card-text-content">
                    <span className="card-main-text accent" id="dashUserId">
                      {session?.userId || '---'}
                    </span>
                    <span className="card-sub-text">
                      {t('dash_account_id', 'Account ID')}
                    </span>
                  </div>
                </div>

                {/* Platform Card with Switcher Option */}
                <div className="unified-card" style={{ justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div className="avatar-circle" id="platformLogoContainer">
                      <img src={activePlatformConfig.logo} alt={activePlatformConfig.name} />
                    </div>
                    <div className="card-text-content">
                      <span className="card-main-text" id="dashPlatform" style={{ color: activePlatformConfig.color }}>
                        {activePlatformConfig.name} Crash
                      </span>
                      <span className="card-sub-text status-badge" id="statusBadge">
                        <span className="status-dot"></span>{' '}
                        <span>{t('dash_active', 'ACTIVE - CONNECTED')}</span>
                      </span>
                    </div>
                  </div>

                  {/* Quick Platform Switcher pills */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {(['1xbet', 'melbet', 'spinbetter'] as PlatformType[]).map((pk) => {
                      const isSel = (session?.platform || selectedPlatform) === pk;
                      return (
                        <button
                          key={pk}
                          type="button"
                          onClick={() => handleSwitchPlatformInDash(pk)}
                          style={{
                            background: isSel ? PLATFORMS_DATA[pk].color : 'rgba(255,255,255,0.06)',
                            color: isSel ? '#000' : '#aaa',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '3px 6px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: '0.2s',
                          }}
                          title={`التبديل إلى ${PLATFORMS_DATA[pk].name}`}
                        >
                          {PLATFORMS_DATA[pk].name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Session countdown timer */}
                <div className="timer-card" style={{ padding: '12px 16px' }}>
                  <div className="timer-label">
                    <i className="fas fa-hourglass-half"></i> {t('dash_time_remaining', 'الوقت المتبقي من الكود')}
                  </div>
                  <div className="timer-display" id="hhmmss">
                    {timerText}
                  </div>
                  <div className="timer-bar-bg">
                    <div
                      className="timer-bar-fill"
                      id="timerBar"
                      style={{ width: `${timerPercent}%` }}
                    ></div>
                  </div>
                </div>

                {/* Back to Login / Logout */}
                <button
                  type="button"
                  className="btn btn-outline lightning-btn"
                  style={{ marginTop: '4px' }}
                  onClick={logout}
                >
                  <i className="fas fa-sign-out-alt"></i> {t('back_btn', 'رجوع لتسجيل الدخول')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===================== MODALS ===================== */}

      {/* 1. Loading Overlay */}
      {showLoadingOverlay && (
        <div id="loadingOverlay" className="modal-overlay active">
          <div className="spinner"></div>
          <h3>{t('loading_title', 'جاري التحقق من بياناتك...')}</h3>
          <p style={{ color: '#aaa', marginTop: '5px' }}>{t('loading_desc', 'الرجاء الانتظار')}</p>
        </div>
      )}

      {/* 2. Success Modal */}
      {showSuccessModal && (
        <div id="successModal" className="modal-overlay alert-modal active">
          <div className="modal-content">
            <button
              type="button"
              className="close-btn"
              onClick={() => setShowSuccessModal(false)}
            >
              <i className="fas fa-times"></i>
            </button>
            <i
              className="fas fa-check-circle"
              style={{ fontSize: '60px', color: '#00e676' }}
            ></i>
            <h2 style={{ color: '#00e676', marginTop: '10px' }}>
              {alertT('success_title', 'تم توليد الكود بنجاح!')}
            </h2>
            <p style={{ color: '#ccc', fontSize: '13px', margin: '5px 0' }}>
              تم تفعيل الكود لمنصة <strong style={{ color: activePlatformConfig.color }}>{activePlatformConfig.name}</strong> بالبرومو كود <strong style={{ color: '#00ffcc' }}>{PROMO_CODE}</strong>
            </p>

            <div className="promo-box" style={{ borderColor: '#00e676', marginTop: '10px' }}>
              <span id="assignedCodeText" style={{ color: '#00e676', fontSize: '18px' }}>
                {generatedCode}
              </span>
              <button
                type="button"
                className="copy-btn"
                style={{ background: codeCopied ? '#fff' : '#00e676' }}
                onClick={handleCopyAssignedCode}
              >
                {codeCopied ? alertT('copied', 'تم النسخ!') : alertT('copy_fast', 'نسخ سريع')}
              </button>
            </div>

            <button
              type="button"
              className="btn-alert"
              style={{ background: '#333', color: '#fff' }}
              onClick={() => setShowSuccessModal(false)}
            >
              {alertT('close_btn', 'إغلاق')}
            </button>

            <button
              type="button"
              className="btn-alert btn-quick-login"
              onClick={handleQuickLogin}
            >
              {t('dash_quick_login', '🚀 تسجيل الدخول السريع')}
            </button>
          </div>
        </div>
      )}

      {/* 3. Video Modal with Tutorial Player */}
      {showVideoModal && (
        <div id="videoModal" className="modal-video active">
          <div className="modal-content">
            <button
              type="button"
              className="close-btn"
              onClick={() => setShowVideoModal(false)}
              aria-label="Close video"
            >
              <i className="fas fa-times-circle"></i>
            </button>
            <iframe
              id="vidFrame"
              src="https://odysee.com/$/embed/@Lafasoo:8/%F0%9F%A4%AF%D9%81%D9%8A%D9%87%D8%B0%D8%A7-%D9%81%D9%8A%D8%B0%D9%8A%D9%88-%D8%B4%D8%B1%D8%AD%D8%AA-%D8%B9%D9%86-%D9%83%D8%B1%D9%8A%D8%A8%D8%AA-%D9%83%D8%B1%D8%A7%D8%B4-%D8%B7%D8%B1%D9%8A%D9%82%D8%A9-%D8%A7%D8%B3%D8%AA%D8%B9%D9%85%D8%A7%D9%84%D9%87:e?r=Bia9nHxHTowTJY3S23mmMKLAJ9Y9oa5o"
              style={{
                width: '100%',
                aspectRatio: '9/16',
                borderRadius: '10px',
                border: 'none',
              }}
              title="THANOS Crash Tutorial"
              allowFullScreen
            ></iframe>
          </div>
        </div>
      )}
    </>
  );
}
