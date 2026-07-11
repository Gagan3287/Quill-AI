import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Lock, ArrowLeft, ChevronRight, Mail } from 'lucide-react';
import { supabase } from './supabase';
import './Login.css';

export default function Login({ onBack, onGuestLogin }) {
  const canvasRef = useRef(null);
  const [loadingProvider, setLoadingProvider] = useState(null); // 'google' | 'github'
  const [error, setError] = useState(null);

  // Email/Password sign-in/sign-up state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);

  /* ── Particle canvas (identical to Landing) ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animFrameId;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const particles = [];
    const count = Math.min(55, Math.floor(w / 30));

    class Particle {
      constructor() {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.35;
        this.vy = (Math.random() - 0.5) * 0.35;
        this.r = Math.random() * 2 + 0.8;
        this.col = Math.random() > 0.5
          ? 'rgba(168,85,247,0.22)'
          : 'rgba(217,70,239,0.18)';
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.x < 0 || this.x > w) this.vx *= -1;
        if (this.y < 0 || this.y > h) this.vy *= -1;
      }
      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = this.col;
        ctx.fill();
      }
    }

    for (let i = 0; i < count; i++) particles.push(new Particle());

    let mx = 0, my = 0;
    const onMove = e => { mx = e.clientX; my = e.clientY; };
    window.addEventListener('mousemove', onMove);

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        const dx = particles[i].x - mx;
        const dy = particles[i].y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 160) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = `rgba(168,85,247,${0.12 * (1 - d / 160)})`;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
        for (let j = i + 1; j < particles.length; j++) {
          const dx2 = particles[i].x - particles[j].x;
          const dy2 = particles[i].y - particles[j].y;
          const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (d2 < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${0.04 * (1 - d2 / 110)})`;
            ctx.lineWidth = 0.4;
            ctx.stroke();
          }
        }
      }
      animFrameId = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  /* ── OAuth handlers ── */
  const handleOAuth = async (provider) => {
    setLoadingProvider(provider);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}#/auth/callback`;
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          scopes: provider === 'github' ? 'read:user user:email' : undefined,
        },
      });
      if (authError) throw authError;
    } catch (err) {
      console.error('OAuth error:', err);
      setError(err.message || `Failed to sign in with ${provider}. Please try again.`);
      setLoadingProvider(null);
    }
  };

  /* ── Email / Password Auth handler ── */
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setLoadingEmail(true);
    setError(null);
    try {
      if (isSignUp) {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (authError) throw authError;
        if (data?.user && !data?.session) {
          setError('Verification email sent! Please check your inbox.');
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (authError) throw authError;
      }
    } catch (err) {
      console.error('Email authentication error:', err);
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoadingEmail(false);
    }
  };


  return (
    <div className="login-root">
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="login-canvas" aria-hidden="true" />

      {/* Ambient glows */}
      <div className="login-glow" aria-hidden="true" />
      <div className="login-glow-bottom" aria-hidden="true" />

      {/* Grid overlay */}
      <div className="login-grid" aria-hidden="true" />

      {/* Back to home button */}
      <button
        className="login-back"
        onClick={onBack}
        aria-label="Back to home"
      >
        <ArrowLeft size={14} />
        Back to home
      </button>

      {/* Login card */}
      <div className="login-card-wrapper">
        <div className="login-card">

          {/* Logo + headings */}
          <div className="login-logo-area">
            <img
              src="/logo-dark.png"
              alt="Quill AI"
              className="login-logo-img"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div className="login-badge">
              <span className="login-badge-dot" />
              Secure Sign‑in
            </div>
            <h1 className="login-title">Welcome to Quill AI</h1>
            <p className="login-subtitle">
              Sign in to unlock <span>AI‑powered document Q&amp;A</span>.<br />
              Your documents stay private and secure.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error" role="alert">
              <AlertCircle size={15} className="login-error-icon" />
              <span>{error}</span>
            </div>
          )}

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="login-email-form">
            <div className="login-input-group">
              <label htmlFor="login-email" className="login-input-label">Email Address</label>
              <div className="login-input-wrapper">
                <Mail className="login-input-icon" size={16} />
                <input
                  type="email"
                  id="login-email"
                  className="login-input"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loadingEmail || !!loadingProvider}
                  required
                />
              </div>
            </div>

            <div className="login-input-group">
              <label htmlFor="login-password" className="login-input-label">Password</label>
              <div className="login-input-wrapper">
                <Lock className="login-input-icon" size={16} />
                <input
                  type="password"
                  id="login-password"
                  className="login-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loadingEmail || !!loadingProvider}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={loadingEmail || !!loadingProvider}
            >
              {loadingEmail ? (
                <span className="login-spinner" />
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>

            <div className="login-toggle-auth">
              <button
                type="button"
                className="login-toggle-btn"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                disabled={loadingEmail || !!loadingProvider}
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="login-divider">
            <div className="login-divider-line" />
            <span className="login-divider-text">Or continue with</span>
            <div className="login-divider-line" />
          </div>

          {/* OAuth buttons */}
          <div className="login-buttons">

            {/* GitHub */}
            <button
              id="btn-login-github"
              className="login-oauth-btn login-oauth-btn--github"
              onClick={() => handleOAuth('github')}
              disabled={loadingEmail || !!loadingProvider}
              aria-label="Continue with GitHub"
            >
              <span className="login-oauth-icon">
                {loadingProvider === 'github' ? (
                  <span className="login-spinner" />
                ) : (
                  /* GitHub SVG logo */
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="#f3f1f6" aria-hidden="true">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                )}
              </span>
              <span className="login-oauth-label">
                {loadingProvider === 'github' ? 'Connecting…' : 'Continue with GitHub'}
              </span>
              <span className="login-oauth-arrow">
                <ChevronRight size={15} />
              </span>
            </button>

            {/* Guest */}
            <button
              id="btn-login-guest"
              className="login-oauth-btn login-oauth-btn--guest"
              onClick={onGuestLogin}
              disabled={!!loadingProvider}
              aria-label="Continue as Guest"
            >
              <span className="login-oauth-icon">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v-2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <span className="login-oauth-label" style={{ color: '#c084fc' }}>
                Continue as Guest
              </span>
              <span className="login-oauth-arrow">
                <ChevronRight size={15} />
              </span>
            </button>
          </div>

          {/* Security note */}
          <div className="login-security">
            <Lock size={11} />
            <span>256‑bit encryption · No passwords stored · GDPR compliant</span>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          By signing in you agree to our{' '}
          <a href="#" onClick={e => e.preventDefault()}>Terms of Service</a>
          {' '}and{' '}
          <a href="#" onClick={e => e.preventDefault()}>Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
