import React, { useEffect, useRef, useState } from 'react';
import { 
  Upload, 
  Database, 
  Search, 
  Cpu, 
  ArrowRight, 
  Shield, 
  Layers, 
  FileText, 
  CheckCircle2, 
  ChevronRight, 
  Play, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  Zap,
  Lock,
  Globe,
  Terminal,
  Activity,
  User,
  Star,
  Quote
} from 'lucide-react';
import './Landing.css';

export default function Landing({ onGetStarted }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeArchStep, setActiveArchStep] = useState(null);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [activePricingPeriod] = useState('monthly');

  const pipelineRef = useRef(null);
  const nodeStackRef = useRef(null);
  const nodeXRef = useRef(null);
  const nodeShieldRef = useRef(null);
  const glowPathRef = useRef(null);
  const corePathRef = useRef(null);
  const gradientRef = useRef(null);
  const splashRef = useRef(null);

  // References for scroll-trigger animations
  const metricsSectionRef = useRef(null);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [counters, setCounters] = useState({ accuracy: 0, speed: 0, formats: 0, responses: 0 });

  // Canvas particle background ref
  const canvasRef = useRef(null);

  // Timeline active sequence state
  const [activeTimelineStep, setActiveTimelineStep] = useState(0);

  // Simulated Chat Demo State
  const [demoMessages, setDemoMessages] = useState([]);
  const [demoState, setDemoState] = useState('typing-user'); // 'typing-user' | 'user' | 'typing-bot' | 'bot'

  // Setup Canvas Particle background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles = [];
    const particleCount = Math.min(60, Math.floor(width / 30));

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.4;
        this.vy = (Math.random() - 0.5) * 0.4;
        this.radius = Math.random() * 2 + 1;
        this.color = Math.random() > 0.5 ? 'rgba(168, 85, 247, 0.25)' : 'rgba(217, 70, 239, 0.2)';
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > width) this.vx = -this.vx;
        if (this.y < 0 || this.y > height) this.vy = -this.vy;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Connect particles
      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();

        // Check distance to mouse
        const dxMouse = particles[i].x - mouseX;
        const dyMouse = particles[i].y - mouseY;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        if (distMouse < 180) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouseX, mouseY);
          ctx.strokeStyle = `rgba(168, 85, 247, ${0.15 * (1 - distMouse / 180)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }

        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.05 * (1 - distance / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Setup original node pipeline SVG animations
  useEffect(() => {
    let animationFrameId;
    let lastStateChange = performance.now();
    let currentState = 'p1';

    const updatePath = () => {
      if (!pipelineRef.current || !nodeStackRef.current || !nodeXRef.current || !nodeShieldRef.current) return;
      
      const pRect = pipelineRef.current.getBoundingClientRect();
      const sRect = nodeStackRef.current.getBoundingClientRect();
      const xRect = nodeXRef.current.getBoundingClientRect();
      const shRect = nodeShieldRef.current.getBoundingClientRect();
      
      const startX = sRect.left + sRect.width / 2 - pRect.left;
      const startY = sRect.top + sRect.height / 2 - pRect.top;
      
      const midX = xRect.left + xRect.width / 2 - pRect.left;
      const midY = xRect.top + xRect.height / 2 - pRect.top;
      
      const endX = shRect.left + shRect.width / 2 - pRect.left;
      const endY = shRect.top + shRect.height / 2 - pRect.top;
      
      const d = `M ${startX},${startY} L ${midX},${midY} L ${endX},${endY}`;
      
      if (glowPathRef.current) glowPathRef.current.setAttribute('d', d);
      if (corePathRef.current) corePathRef.current.setAttribute('d', d);
    };

    const animate = (time) => {
      const elapsed = time - lastStateChange;
      
      if (currentState === 'p1') {
        if (elapsed < 800) {
          const p = elapsed / 800;
          const percentage = p * 0.5;
          const center = percentage * 100;
          if (gradientRef.current) {
            gradientRef.current.setAttribute('x1', `${center - 5}%`);
            gradientRef.current.setAttribute('x2', `${center + 5}%`);
          }
          if (p < 0.4 && nodeStackRef.current) {
            nodeStackRef.current.classList.add('active');
          } else if (nodeStackRef.current) {
            nodeStackRef.current.classList.remove('active');
          }
        } else {
          currentState = 'splash';
          lastStateChange = time;
          if (glowPathRef.current) glowPathRef.current.style.opacity = '0';
          if (corePathRef.current) corePathRef.current.style.opacity = '0';
          if (splashRef.current) splashRef.current.classList.add('animate');
        }
      } else if (currentState === 'splash') {
        if (elapsed >= 800) {
          currentState = 'p2';
          lastStateChange = time;
          if (splashRef.current) splashRef.current.classList.remove('animate');
          if (glowPathRef.current) glowPathRef.current.style.opacity = '0.6';
          if (corePathRef.current) corePathRef.current.style.opacity = '1';
        }
      } else if (currentState === 'p2') {
        if (elapsed < 800) {
          const p = elapsed / 800;
          const percentage = 0.5 + (p * 0.5);
          const center = percentage * 100;
          if (gradientRef.current) {
            gradientRef.current.setAttribute('x1', `${center - 5}%`);
            gradientRef.current.setAttribute('x2', `${center + 5}%`);
          }
          if (p > 0.6 && nodeShieldRef.current) {
            nodeShieldRef.current.classList.add('active');
          } else if (nodeShieldRef.current) {
            nodeShieldRef.current.classList.remove('active');
          }
        } else {
          currentState = 'idle';
          lastStateChange = time;
          if (nodeShieldRef.current) nodeShieldRef.current.classList.remove('active');
          if (glowPathRef.current) glowPathRef.current.style.opacity = '0';
          if (corePathRef.current) corePathRef.current.style.opacity = '0';
        }
      } else if (currentState === 'idle') {
        if (elapsed >= 1000) {
          currentState = 'p1';
          lastStateChange = time;
          if (glowPathRef.current) glowPathRef.current.style.opacity = '0.6';
          if (corePathRef.current) corePathRef.current.style.opacity = '1';
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    updatePath();
    window.addEventListener('resize', updatePath);
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', updatePath);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Timeline automatic cycle effect
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTimelineStep((prev) => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Metrics IntersectionObserver for counting animation
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMetricsVisible(true);
        }
      },
      { threshold: 0.2 }
    );
    if (metricsSectionRef.current) {
      observer.observe(metricsSectionRef.current);
    }
    return () => {
      if (metricsSectionRef.current) {
        observer.unobserve(metricsSectionRef.current);
      }
    };
  }, []);

  // Animate metrics counter values
  useEffect(() => {
    if (!metricsVisible) return;

    let startTime = null;
    const duration = 2000; // 2 seconds animation

    const targetAccuracy = 95;
    const targetSpeed = 48; // Represents ms
    const targetFormats = 4;
    const targetResponses = 100;

    const animateCounters = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing curve (easeOutExpo)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      setCounters({
        accuracy: Math.floor(ease * targetAccuracy),
        speed: Math.floor(ease * targetSpeed),
        formats: Math.floor(ease * targetFormats),
        responses: Math.floor(ease * targetResponses),
      });

      if (progress < 1) {
        requestAnimationFrame(animateCounters);
      }
    };

    requestAnimationFrame(animateCounters);
  }, [metricsVisible]);

  // Product Chat Interface Simulated Loop
  useEffect(() => {
    let timer;
    if (demoState === 'typing-user') {
      timer = setTimeout(() => {
        setDemoMessages([{ role: 'user', content: 'When is the payment due?' }]);
        setDemoState('typing-bot');
      }, 1500);
    } else if (demoState === 'typing-bot') {
      timer = setTimeout(() => {
        setDemoMessages((prev) => [
          ...prev,
          {
            role: 'bot',
            content: 'The payment must be completed within 30 days of invoice issuance.',
            sources: [{ source: 'Contract.pdf', page: 3, snippet: 'Payments are to be disbursed to the designated account not later than 30 days after the invoice generation date.' }]
          }
        ]);
        setDemoState('bot');
      }, 2500);
    } else if (demoState === 'bot') {
      // Loop reset
      timer = setTimeout(() => {
        setDemoMessages([]);
        setDemoState('typing-user');
      }, 8000);
    }

    return () => clearTimeout(timer);
  }, [demoState]);

  // Pricing plans list
  const pricingPlans = [
    {
      name: 'Starter',
      price: activePricingPeriod === 'monthly' ? '$0' : '$0',
      period: 'free forever',
      desc: 'Perfect for exploring Quill AI’s core capabilities.',
      badge: 'Sandbox',
      features: [
        'Up to 10 document uploads',
        'Max file size: 5MB per file',
        'Standard semantic vector search',
        'Source citations with page numbers',
        '100 queries / month'
      ],
      popular: false,
      cta: 'Start Free Now'
    },
    {
      name: 'Professional',
      price: activePricingPeriod === 'monthly' ? '$29' : '$23',
      period: 'per user / month',
      desc: 'Supercharged document intelligence for professionals.',
      badge: 'Popular',
      features: [
        'Unlimited document uploads',
        'Max file size: 50MB per file',
        'Advanced hybrid vector retrieval',
        'Cross-document querying',
        '10,000 queries / month',
        'Priority model access & speed',
        'API keys configuration support'
      ],
      popular: true,
      cta: 'Upgrade to Pro'
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'for teams & organizations',
      desc: 'High-scale RAG capabilities with security compliance.',
      badge: 'Premium',
      features: [
        'Dedicated secure DB tenant',
        'No file size restrictions',
        'Self-hosted or on-prem deployment options',
        'Custom fine-tuned embeddings',
        'Unlimited monthly queries',
        'SSO/SAML Authentication',
        '24/7 dedicated support'
      ],
      popular: false,
      cta: 'Contact Sales'
    }
  ];

  // Testimonial list
  const testimonials = [
    {
      quote: "Quill AI transformed how our legal team reviews contracts. What used to take hours of manual Ctrl+F searching is now solved in seconds with precise page citations.",
      author: "Vengala Gagan",
      role: "Lead Counsel",
      company: "Apex Legal Partners",
      avatar: "VG"
    },
    {
      quote: "We connected Quill AI to our entire product documentation archive. Now, developers get instant, reliable answers without searching endless README files. The speed of the FAISS engine is mind-blowing.",
      author: "Ganji Anirudh",
      role: "VP of Engineering",
      company: "CloudCore Systems",
      avatar: "GA"
    },
    {
      quote: "Accuracy is everything for us. Other AI services hallucinate, but Quill's strict source grounding and citation chip ensure every answer is backed by verifiable PDF pages.",
      author: "Pulloju Ajith",
      role: "Director of Research",
      company: "BioMed Labs",
      avatar: "PA"
    }
  ];

  // Architecture components detailed view
  const architectureNodes = [
    { 
      id: 'user', 
      title: 'User Interface', 
      tech: 'React & Vite', 
      desc: 'Stunning glassmorphism dashboard built with modern React. Includes instant file dropzones, real-time query rendering, source-grounded chips, and visual transition states.' 
    },
    { 
      id: 'frontend', 
      title: 'API Gateway', 
      tech: 'Axios Connection', 
      desc: 'Secured HTTP payload communications forwarding queries, managing documents state, and stream-ready interfaces.' 
    },
    { 
      id: 'backend', 
      title: 'FastAPI Backend', 
      tech: 'Python API Server', 
      desc: 'High-concurrency framework with optimized endpoints for ingestion, document status mapping, context extraction, and vector index sync.' 
    },
    { 
      id: 'processing', 
      title: 'Document Parser', 
      tech: 'PyMuPDF, python-docx, python-pptx', 
      desc: 'High-fidelity parser. Extracts raw texts, maintains layout context, strips metadata, and computes index offsets preserving page alignments.' 
    },
    { 
      id: 'embedding', 
      title: 'Embedding Engine', 
      tech: 'Sentence-Transformers / OpenAI Ada', 
      desc: 'Processes extracted text chunks into high-dimensional numerical vectors, mapping semantic meanings in 1536-dimensional hyper-space.' 
    },
    { 
      id: 'db', 
      title: 'Vector Store', 
      tech: 'FAISS Vector Index', 
      desc: 'Performs nearest-neighbor semantic search (L2 distance metric) in under 50ms, retrieving top matching context chunks for user questions.' 
    },
    { 
      id: 'llm', 
      title: 'LLM Generator', 
      tech: 'GPT Orchestrator', 
      desc: 'Synthesizes retrieved chunks and original query within an strict grounding prompt template, generating context-only, hallucination-free answers.' 
    },
    { 
      id: 'response', 
      title: 'Response Engine', 
      tech: 'Citation Generator', 
      desc: 'Extracts exact source coordinates (filenames, page numbers, matching snippets) and packages them into the unified JSON client response.' 
    }
  ];

  return (
    <div className="landing-container">
      {/* NAVBAR */}
      <nav className="nav-bar">
        <div className="nav-logo">
          <img src="/logo-dark.png" alt="Quill AI Logo" className="nav-logo-img" />
          <span>Quill AI</span>
        </div>
        
        <button 
          className={`menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span></span>
          <span></span>
        </button>

        <div className={`nav-menu ${mobileMenuOpen ? 'active' : ''}`}>
          <ul className="nav-links">
            <li>
              <a
                href="#how-it-works"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >Method</a>
            </li>
            <li>
              <a
                href="#architecture"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >Docs</a>
            </li>
          </ul>
          <div className="nav-spacer"></div>
        </div>
      </nav>

      {/* HERO CARD */}
      <section className="hero-card">
        <div className="hero-grid"></div>
        
        {/* ICON PIPELINE */}
        <div className="icon-pipeline" ref={pipelineRef}>
          <svg className="beam-svg">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <linearGradient id="beam-gradient" ref={gradientRef} gradientUnits="userSpaceOnUse" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#00e5ff" stopOpacity="0" />
                <stop offset="20%" stopColor="#00e5ff" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#00f55e" stopOpacity="1" />
                <stop offset="80%" stopColor="#a855f7" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path ref={glowPathRef} stroke="url(#beam-gradient)" strokeWidth="2" filter="url(#glow)" style={{ opacity: 0.6 }} fill="none" />
            <path ref={corePathRef} stroke="url(#beam-gradient)" strokeWidth="0.8" fill="none" />
          </svg>

          <div className="icon-node node-light-right" id="node-stack" ref={nodeStackRef}>
            <svg viewBox="0 0 24 24">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>

          <div className="pipeline-line"></div>

          <div className="center-wrapper">
            <div className="splash" ref={splashRef}></div>
            <div className="icon-node-center" id="node-x" ref={nodeXRef}>
              <svg viewBox="0 0 40 40">
                <path d="M26.248,13.784l-4.576,6.313l5.385,7.119h-4.214l-3.238-4.28l-3.71,4.28h-5.241l4.981-5.746l-5.112-6.759h4.326 l2.934,3.878l3.411-3.878H26.248z M22.756,25.968h2.395l-9.61-12.7h-2.534L22.756,25.968z" />
              </svg>
            </div>
          </div>

          <div className="pipeline-line right"></div>

          <div className="icon-node node-light-left" id="node-shield" ref={nodeShieldRef}>
            <svg viewBox="0 0 24 24">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
        </div>

        <div className="hero-content">
          <h1 className="hero-heading">
            Turn Documents Into
            <strong> Intelligent Conversations</strong>
          </h1>
          <p className="hero-sub">
            Upload PDFs, DOCX, PPTX, and TXT files. Quill AI retrieves relevant knowledge instantly<br />
            and delivers accurate, source-backed answers powered by Retrieval-Augmented Generation.
          </p>
          <button className="btn-cta" onClick={onGetStarted}>Start Free</button>
        </div>
      </section>



      {/* HOW IT WORKS SECTION */}
      <section id="how-it-works" className="how-it-works-section">
        <div className="section-header">
          <span className="section-tag">How It Works</span>
          <h2 className="section-title">Seamless Document-to-Knowledge Pipeline</h2>
          <p className="section-subtitle">
            Our automated RAG model indexes, processes, searches, and generates responses securely.
          </p>
        </div>

        <div className="process-timeline">
          <div className="timeline-progress-line">
            <div 
              className="timeline-progress-fill" 
              style={{ width: `${(activeTimelineStep / 3) * 100}%` }}
            ></div>
          </div>

          <div className="timeline-grid">
            {[
              {
                title: 'Upload',
                desc: 'Drag and drop files securely',
                icon: <Upload size={24} />,
                color: 'purple'
              },
              {
                title: 'Index',
                desc: 'Documents are chunked and converted into vector embeddings',
                icon: <Database size={24} />,
                color: 'pink'
              },
              {
                title: 'Retrieve',
                desc: 'Relevant knowledge is retrieved through semantic search',
                icon: <Search size={24} />,
                color: 'blue'
              },
              {
                title: 'Generate',
                desc: 'AI generates context-aware responses with citations',
                icon: <Cpu size={24} />,
                color: 'emerald'
              }
            ].map((step, idx) => (
              <div 
                key={idx} 
                className={`timeline-card glass clickable ${activeTimelineStep === idx ? 'active' : ''}`}
                onClick={() => setActiveTimelineStep(idx)}
              >
                <div className={`step-icon-wrapper ${step.color}`}>
                  {step.icon}
                </div>
                <div className="step-badge">Step 0{idx + 1}</div>
                <h3 className="step-card-title">{step.title}</h3>
                <p className="step-card-desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ARCHITECTURE SHOWCASE */}
      <section id="architecture" className="arch-section">
        <div className="section-header">
          <span className="section-tag">Infrastructure</span>
          <h2 className="section-title">Enterprise RAG Stack</h2>
          <p className="section-subtitle">
            Designed for sub-50ms search latency, verified factual alignment, and standard security boundaries.
          </p>
        </div>

        <div className="arch-grid">
          {/* Left: Diagram Flow */}
          <div className="arch-diagram glass">
            <div className="diagram-header">
              <Terminal size={14} className="text-purple-400" />
              <span>Pipeline Data Flow</span>
            </div>
            
            <div className="diagram-nodes">
              {architectureNodes.map((node, idx) => (
                <React.Fragment key={node.id}>
                  <div 
                    className={`diagram-node-item glass ${activeArchStep === node.id ? 'active' : ''}`}
                    onMouseEnter={() => setActiveArchStep(node.id)}
                    onMouseLeave={() => setActiveArchStep(null)}
                  >
                    <div className="node-num">{idx + 1}</div>
                    <div className="node-info">
                      <div className="node-name">{node.title}</div>
                      <div className="node-tech">{node.tech}</div>
                    </div>
                  </div>
                  {idx < architectureNodes.length - 1 && (
                    <div className="diagram-connector-line">
                      <div className="line-bead"></div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Right: Technical Specifications */}
          <div className="arch-details-card glass">
            {activeArchStep ? (
              <div className="details-active-state animate-fade-in">
                <div className="details-icon-header">
                  <Activity size={24} className="text-purple-400 animate-pulse" />
                  <span className="details-active-tag">Active Node Specs</span>
                </div>
                <h3 className="details-title">
                  {architectureNodes.find(n => n.id === activeArchStep).title}
                </h3>
                <div className="details-tech-badge">
                  {architectureNodes.find(n => n.id === activeArchStep).tech}
                </div>
                <p className="details-description">
                  {architectureNodes.find(n => n.id === activeArchStep).desc}
                </p>
              </div>
            ) : (
              <div className="details-idle-state">
                <Layers size={40} className="text-gray-600 mb-4" />
                <h3>Hover over pipeline nodes</h3>
                <p>
                  Explore the technology and deep processing logic powering every step of the Quill AI RAG stack.
                </p>
                <div className="details-quick-specs">
                  <div className="quick-spec-item">
                    <strong>FastAPI Backend</strong>
                    <span>High-concurrency Python engine</span>
                  </div>
                  <div className="quick-spec-item">
                    <strong>FAISS Search</strong>
                    <span>Ultra-fast index search</span>
                  </div>
                  <div className="quick-spec-item">
                    <strong>GPT Generation</strong>
                    <span>Strictly aligned synthesis</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="features-section">
        <div className="section-header">
          <span className="section-tag">Capabilities</span>
          <h2 className="section-title">Built for Enterprise-Grade Intelligence</h2>
          <p className="section-subtitle">
            Everything you need to retrieve answers, citations, and metadata from your corporate archives instantly.
          </p>
        </div>

        <div className="features-grid">
          {[
            {
              title: 'Intelligent Retrieval',
              desc: 'Semantic search powered by high-dimensional vector embeddings ensures relevant context matches.',
              icon: <Search className="text-purple-400" />
            },
            {
              title: 'Multi-Document Understanding',
              desc: 'Query across multiple files including PDFs, PPTs, DOCX, and TXT files simultaneously.',
              icon: <Layers className="text-pink-400" />
            },
            {
              title: 'Source Citations',
              desc: 'Every answer is backed by traceable evidence, showing the source file, page number, and original quote.',
              icon: <FileText className="text-emerald-400" />
            },
            {
              title: 'Lightning Fast Search',
              desc: 'FAISS-powered vector retrieval finds relevant excerpts in milliseconds even in massive index datasets.',
              icon: <Zap className="text-yellow-400" />
            },
            {
              title: 'Secure Processing',
              desc: 'Your files are stored in temporarily isolated instances, and deleted immediately after processing.',
              icon: <Lock className="text-blue-400" />
            },
            {
              title: 'Enterprise Ready',
              desc: 'Robust modular API boundaries, scalable backend, and production-tested CORS setup ready to deploy.',
              icon: <Globe className="text-indigo-400" />
            }
          ].map((feat, idx) => (
            <div key={idx} className="feature-card glass">
              <div className="feature-icon-box">{feat.icon}</div>
              <h3 className="feature-card-title">{feat.title}</h3>
              <p className="feature-card-desc">{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCT DEMO SECTION */}
      <section id="demo" className="demo-section">
        <div className="section-header">
          <span className="section-tag">Product Demo</span>
          <h2 className="section-title">Conversational Knowledge Extraction</h2>
          <p className="section-subtitle">
            See how users extract factual evidence in real time.
          </p>
        </div>

        <div className="demo-chat-container glass">
          <div className="chat-window-header">
            <div className="chat-circle red"></div>
            <div className="chat-circle yellow"></div>
            <div className="chat-circle green"></div>
            <span className="chat-window-title">Demo Console — Quill AI</span>
          </div>

          <div className="chat-window-body">
            {/* User message */}
            {demoMessages.length > 0 && (
              <div className="demo-msg user-msg-container">
                <div className="msg-bubble user-bubble">
                  {demoMessages[0].content}
                </div>
              </div>
            )}

            {/* Typing user */}
            {demoState === 'typing-user' && (
              <div className="demo-msg user-msg-container">
                <div className="msg-bubble user-bubble typing-ellipsis">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}

            {/* Typing bot */}
            {demoState === 'typing-bot' && (
              <div className="demo-msg bot-msg-container">
                <div className="bot-avatar"><Sparkles size={14} /></div>
                <div className="msg-bubble bot-bubble typing-ellipsis">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}

            {/* Bot Response */}
            {demoMessages.length > 1 && (
              <div className="demo-msg bot-msg-container">
                <div className="bot-avatar"><Sparkles size={14} /></div>
                <div className="msg-bubble bot-bubble">
                  <p className="bot-text">{demoMessages[1].content}</p>
                  
                  {/* Sources chips */}
                  {demoMessages[1].sources && (
                    <div className="demo-sources">
                      <div className="sources-label">Sources:</div>
                      {demoMessages[1].sources.map((s, i) => (
                        <div key={i} className="source-chip glass">
                          <span className="chip-file">{s.source}</span>
                          <span className="chip-divider">—</span>
                          <span className="chip-page">Page {s.page}</span>
                          
                          {/* Hover tooltip with snippet */}
                          <div className="chip-tooltip glass">
                            "{s.snippet}"
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* WHY QUILL AI (METRICS) */}
      <section ref={metricsSectionRef} className="metrics-section">
        <div className="metrics-grid">
          <div className="metric-item">
            <div className="metric-number">
              <span>{counters.accuracy}</span>%
            </div>
            <div className="metric-label">Retrieval Accuracy</div>
            <p className="metric-desc">Near-zero hallucination rate grounded by citations</p>
          </div>

          <div className="metric-item">
            <div className="metric-number">
              &lt;<span>{counters.speed}</span>ms
            </div>
            <div className="metric-label">Semantic Search Speed</div>
            <p className="metric-desc">Sub-millisecond similarity scans powered by FAISS</p>
          </div>

          <div className="metric-item">
            <div className="metric-number">
              <span>{counters.formats}</span>+
            </div>
            <div className="metric-label">Supported Document Formats</div>
            <p className="metric-desc">Ingest PDFs, Word docs, Presentations & plain text</p>
          </div>

          <div className="metric-item">
            <div className="metric-number">
              <span>{counters.responses}</span>%
            </div>
            <div className="metric-label">Source Verified Responses</div>
            <p className="metric-desc">Every response links back to original text segments</p>
          </div>
        </div>
      </section>

      {/* DEVELOPER EXCELLENCE SECTION */}
      <section className="developer-section">
        <div className="section-header">
          <span className="section-tag">Tech Stack</span>
          <h2 className="section-title">Engineered for Developer Speed</h2>
          <p className="section-subtitle">
            A modular foundation built with the fastest libraries in python and web development.
          </p>
        </div>

        <div className="tech-stack-grid">
          <div className="tech-stack-card glass">
            <div className="tech-card-header">
              <Layers size={18} className="text-purple-400" />
              <h3>Frontend Architecture</h3>
            </div>
            <ul className="tech-list">
              <li>
                <strong>React Single Page App</strong>
                <span>Efficient responsive interface & instant updates</span>
              </li>
              <li>
                <strong>Modern CSS Utilities</strong>
                <span>High-performance animations without overhead libraries</span>
              </li>
              <li>
                <strong>Tailored Breakpoints</strong>
                <span>Pixel-perfect views from compact phones to ultra-wide displays</span>
              </li>
            </ul>
          </div>

          <div className="tech-stack-card glass">
            <div className="tech-card-header">
              <Terminal size={18} className="text-pink-400" />
              <h3>FastAPI Backend</h3>
            </div>
            <ul className="tech-list">
              <li>
                <strong>FastAPI Core Framework</strong>
                <span>Asynchronous request handlers with auto-docs routing</span>
              </li>
              <li>
                <strong>Clean REST APIs</strong>
                <span>Standard schema contracts with CORS access layers</span>
              </li>
              <li>
                <strong>Safety Boundaries</strong>
                <span>Robust cleanup processes removing temp buffers instantly</span>
              </li>
            </ul>
          </div>

          <div className="tech-stack-card glass">
            <div className="tech-card-header">
              <Cpu size={18} className="text-emerald-400" />
              <h3>AI & RAG Engine Layer</h3>
            </div>
            <ul className="tech-list">
              <li>
                <strong>Advanced Vector Indexing</strong>
                <span>Optimized multi-file mapping using local vector spaces</span>
              </li>
              <li>
                <strong>Semantic Embeddings</strong>
                <span>Transforms raw sections into dense numerical clusters</span>
              </li>
              <li>
                <strong>Generative Synergy</strong>
                <span>Engineered contexts maximizing precise response outcomes</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="testimonials-section">
        <div className="section-header">
          <span className="section-tag">Testimonials</span>
          <h2 className="section-title">What Builders Say</h2>
        </div>

        <div className="testimonials-carousel-wrapper">
          <div className="testimonial-card glass">
            <Quote className="quote-icon" />
            <p className="quote-text">"{testimonials[currentTestimonial].quote}"</p>
            
            <div className="testimonial-author">
              <div className="author-avatar">{testimonials[currentTestimonial].avatar}</div>
              <div className="author-info">
                <span className="author-name">{testimonials[currentTestimonial].author}</span>
              </div>
            </div>
          </div>

          <div className="carousel-controls">
            {testimonials.map((_, idx) => (
              <button 
                key={idx} 
                className={`carousel-dot ${currentTestimonial === idx ? 'active' : ''}`}
                onClick={() => setCurrentTestimonial(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              ></button>
            ))}
          </div>
        </div>
      </section>


      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="footer-logo">
              <img src="/logo-dark.png" alt="Quill AI Logo" className="nav-logo-img" />
              <span>Quill AI</span>
            </div>
            <p className="footer-tagline">Making retrieval-augmented intelligence accessible for all teams.</p>
          </div>
          
          <div className="footer-links-grid">
            <div className="footer-column">
              <h4>Product</h4>
              <ul>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><a href="#features">Features</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Developers</h4>
              <ul>
                <li><a href="#architecture">Architecture</a></li>
                <li><a href="file:///d:/projects%20training/RAG%20model/backend/main.py" target="_blank" rel="noopener noreferrer">FastAPI Source</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>API Reference</a></li>
              </ul>
            </div>
            <div className="footer-column">
              <h4>Security</h4>
              <ul>
                <li><a href="#" onClick={(e) => e.preventDefault()}>GDPR Compliance</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Data Policy</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Quill AI Technologies. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
