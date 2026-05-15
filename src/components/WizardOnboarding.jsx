import React, { useState, useEffect } from 'react';

const STORAGE_KEY = 'bi-dashboard.wizard-done.v1';

const STEPS = [
  {
    id: 'welcome',
    icon: '👋',
    titleTh: 'ยินดีต้อนรับ!',
    subtitleEn: 'Welcome to Dashboard Builder',
    descTh: 'Dashboard Builder ช่วยให้คุณสร้างหน้าจอแสดงข้อมูลได้เองแบบง่ายๆ ลากวาง ไม่ต้องเขียนโค้ด',
    illustration: (
      <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="30" width="200" height="110" rx="12" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1.5"/>
        <rect x="34" y="44" width="80" height="50" rx="8" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
        <rect x="126" y="44" width="80" height="50" rx="8" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
        <rect x="34" y="104" width="172" height="26" rx="8" fill="#bfdbfe" stroke="#93c5fd" strokeWidth="1"/>
        {/* chart lines */}
        <polyline points="42,82 55,66 68,74 81,58 94,70 107,54" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="55" cy="66" r="3" fill="#2563eb"/>
        <circle cx="81" cy="58" r="3" fill="#2563eb"/>
        <circle cx="107" cy="54" r="3" fill="#2563eb"/>
        {/* bar chart */}
        <rect x="136" y="72" width="10" height="18" rx="2" fill="#3b82f6" opacity="0.7"/>
        <rect x="150" y="62" width="10" height="28" rx="2" fill="#1d4ed8"/>
        <rect x="164" y="68" width="10" height="22" rx="2" fill="#3b82f6" opacity="0.7"/>
        <rect x="178" y="58" width="10" height="32" rx="2" fill="#1d4ed8"/>
        {/* table rows */}
        <rect x="42" y="110" width="60" height="5" rx="2" fill="#93c5fd"/>
        <rect x="110" y="110" width="40" height="5" rx="2" fill="#bfdbfe"/>
        <rect x="158" y="110" width="36" height="5" rx="2" fill="#bfdbfe"/>
        {/* stars */}
        <text x="195" y="28" fontSize="16">✨</text>
        <text x="14" y="28" fontSize="14">📊</text>
      </svg>
    )
  },
  {
    id: 'palette',
    icon: '🧩',
    titleTh: 'เพิ่ม Widget',
    subtitleEn: 'Add Widgets from the Palette',
    descTh: 'แผงด้านซ้ายมี Widget หลายประเภท ลากมาวางบน Canvas เพื่อเริ่มสร้าง Dashboard ของคุณ',
    highlight: 'palette',
    illustration: (
      <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* palette panel */}
        <rect x="10" y="20" width="72" height="120" rx="10" fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="1.5"/>
        <rect x="18" y="32" width="56" height="28" rx="6" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
        <rect x="18" y="66" width="56" height="28" rx="6" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
        <rect x="18" y="100" width="56" height="28" rx="6" fill="#dbeafe" stroke="#93c5fd" strokeWidth="1"/>
        <text x="30" y="50" fontSize="14">📈</text>
        <text x="30" y="84" fontSize="14">📋</text>
        <text x="30" y="118" fontSize="14">🔢</text>
        <text x="48" y="50" fontSize="8" fill="#1d4ed8" fontWeight="bold">Chart</text>
        <text x="48" y="84" fontSize="8" fill="#1d4ed8" fontWeight="bold">Table</text>
        <text x="48" y="118" fontSize="8" fill="#1d4ed8" fontWeight="bold">KPI</text>
        {/* arrow */}
        <path d="M92 80 Q110 70 130 75" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="5,3" fill="none" markerEnd="url(#arrow)"/>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b"/>
          </marker>
        </defs>
        {/* canvas */}
        <rect x="100" y="20" width="130" height="120" rx="10" fill="#f8fafc" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="5,4"/>
        {/* dragged widget */}
        <rect x="118" y="60" width="90" height="50" rx="8" fill="white" stroke="#2563eb" strokeWidth="2" opacity="0.95"/>
        <polyline points="126,96 136,80 148,88 162,72 176,84 196,68" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* drag cursor */}
        <text x="148" y="58" fontSize="16">✋</text>
      </svg>
    )
  },
  {
    id: 'configure',
    icon: '⚙️',
    titleTh: 'ตั้งค่า Widget',
    subtitleEn: 'Configure Your Widget',
    descTh: 'วาง mouse บน Widget แล้วคลิกปุ่ม ⚙ เพื่อเลือกข้อมูลที่ต้องการแสดง ทั้ง field mapping และ chart type',
    highlight: 'widget-controls',
    illustration: (
      <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* widget card */}
        <rect x="30" y="20" width="150" height="100" rx="10" fill="white" stroke="#2563eb" strokeWidth="2"/>
        {/* widget header */}
        <rect x="30" y="20" width="150" height="28" rx="10" fill="#eff6ff"/>
        <rect x="30" y="34" width="150" height="14" rx="0" fill="#eff6ff"/>
        <text x="42" y="38" fontSize="9" fill="#1d4ed8" fontWeight="bold">MICE Revenue Chart</text>
        {/* config button highlight */}
        <circle cx="162" cy="33" r="11" fill="#1d4ed8"/>
        <text x="157" y="37" fontSize="11" fill="white">⚙</text>
        {/* pulse ring */}
        <circle cx="162" cy="33" r="16" stroke="#3b82f6" strokeWidth="2" opacity="0.4" strokeDasharray="3,3"/>
        {/* chart inside */}
        <polyline points="50,106 68,82 88,92 110,68 132,80 160,58 178,72" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6"/>
        {/* config panel */}
        <rect x="190" y="30" width="44" height="110" rx="8" fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="1.5"/>
        <rect x="196" y="38" width="32" height="8" rx="3" fill="#bfdbfe"/>
        <rect x="196" y="50" width="32" height="8" rx="3" fill="#93c5fd"/>
        <rect x="196" y="62" width="32" height="8" rx="3" fill="#bfdbfe"/>
        <rect x="196" y="78" width="32" height="12" rx="4" fill="#1d4ed8"/>
        <text x="200" y="88" fontSize="7" fill="white" fontWeight="bold">Apply</text>
        {/* arrow */}
        <path d="M175 33 L187 33" stroke="#f59e0b" strokeWidth="2" fill="none" markerEnd="url(#arrow2)"/>
        <defs>
          <marker id="arrow2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#f59e0b"/>
          </marker>
        </defs>
      </svg>
    )
  },
  {
    id: 'preview',
    icon: '👁️',
    titleTh: 'ดูตัวอย่าง & แก้ไข',
    subtitleEn: 'Preview & Edit Mode',
    descTh: 'คลิกปุ่ม ◐ (Preview) เพื่อดูหน้าตาจริง หรือปุ่ม ✎ (Edit) เพื่อกลับมาแก้ไข จัดวางใหม่ได้ตลอด',
    illustration: (
      <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* two mode cards */}
        {/* edit mode */}
        <rect x="10" y="30" width="100" height="110" rx="10" fill="#f8fafc" stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="4,3"/>
        <text x="22" y="52" fontSize="8" fill="#64748b" fontWeight="bold">EDIT MODE</text>
        <rect x="18" y="58" width="80" height="35" rx="6" fill="white" stroke="#93c5fd" strokeWidth="1"/>
        <rect x="18" y="98" width="38" height="35" rx="6" fill="white" stroke="#93c5fd" strokeWidth="1"/>
        <rect x="60" y="98" width="38" height="35" rx="6" fill="white" stroke="#93c5fd" strokeWidth="1"/>
        {/* grid dots */}
        <circle cx="22" cy="62" r="1.5" fill="#cbd5e1"/>
        <circle cx="94" cy="62" r="1.5" fill="#cbd5e1"/>
        <circle cx="22" cy="128" r="1.5" fill="#cbd5e1"/>
        {/* preview mode */}
        <rect x="128" y="30" width="102" height="110" rx="10" fill="white" stroke="#2563eb" strokeWidth="2"/>
        <text x="140" y="52" fontSize="8" fill="#1d4ed8" fontWeight="bold">PREVIEW MODE</text>
        <rect x="136" y="58" width="86" height="35" rx="6" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1"/>
        <rect x="136" y="98" width="40" height="35" rx="6" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1"/>
        <rect x="180" y="98" width="42" height="35" rx="6" fill="#eff6ff" stroke="#93c5fd" strokeWidth="1"/>
        <polyline points="144,82 156,68 170,76 184,62 198,70 212,58" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* toggle button */}
        <rect x="96" y="20" width="48" height="24" rx="12" fill="#0f172a"/>
        <circle cx="108" cy="32" r="8" fill="white" opacity="0.3"/>
        <circle cx="132" cy="32" r="8" fill="white"/>
        <text x="100" y="37" fontSize="10" fill="white">✎  ◐</text>
      </svg>
    )
  },
  {
    id: 'filters',
    icon: '🔍',
    titleTh: 'กรองข้อมูล',
    subtitleEn: 'Use Filters',
    descTh: 'ใช้แผง Filters เพื่อเลือกปี, ตลาด, อุตสาหกรรม และประเทศ Widget ทุกอันจะอัปเดตอัตโนมัติ',
    illustration: (
      <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* filter panel */}
        <rect x="15" y="20" width="210" height="60" rx="10" fill="#f0f9ff" stroke="#7dd3fc" strokeWidth="1.5"/>
        <text x="26" y="38" fontSize="8" fill="#0369a1" fontWeight="bold">FILTERS</text>
        {/* filter chips */}
        <rect x="26" y="44" width="44" height="18" rx="9" fill="#0f172a"/>
        <text x="30" y="57" fontSize="7" fill="white" fontWeight="bold">International</text>
        <rect x="76" y="44" width="36" height="18" rx="9" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <text x="83" y="57" fontSize="7" fill="#64748b">Domestic</text>
        <rect x="122" y="44" width="32" height="18" rx="9" fill="#1d4ed8"/>
        <text x="127" y="57" fontSize="7" fill="white" fontWeight="bold">2024</text>
        <rect x="162" y="44" width="26" height="18" rx="9" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <text x="167" y="57" fontSize="7" fill="#64748b">2023</text>
        {/* update arrows */}
        <path d="M60 88 L60 100" stroke="#f59e0b" strokeWidth="1.5" markerEnd="url(#arrowDown1)" strokeDasharray="3,2"/>
        <path d="M120 88 L120 100" stroke="#f59e0b" strokeWidth="1.5" markerEnd="url(#arrowDown2)" strokeDasharray="3,2"/>
        <path d="M180 88 L180 100" stroke="#f59e0b" strokeWidth="1.5" markerEnd="url(#arrowDown3)" strokeDasharray="3,2"/>
        <defs>
          <marker id="arrowDown1" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
            <path d="M0,0 L6,0 L3,6 z" fill="#f59e0b"/>
          </marker>
          <marker id="arrowDown2" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
            <path d="M0,0 L6,0 L3,6 z" fill="#f59e0b"/>
          </marker>
          <marker id="arrowDown3" markerWidth="6" markerHeight="6" refX="3" refY="5" orient="auto">
            <path d="M0,0 L6,0 L3,6 z" fill="#f59e0b"/>
          </marker>
        </defs>
        {/* widgets updating */}
        <rect x="20" y="100" width="72" height="48" rx="8" fill="white" stroke="#93c5fd" strokeWidth="1"/>
        <polyline points="28,136 38,120 50,128 62,112 74,122 84,108" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <rect x="100" y="100" width="60" height="48" rx="8" fill="white" stroke="#93c5fd" strokeWidth="1"/>
        <rect x="108" y="110" width="10" height="30" rx="2" fill="#3b82f6" opacity="0.6"/>
        <rect x="122" y="118" width="10" height="22" rx="2" fill="#1d4ed8"/>
        <rect x="136" y="114" width="10" height="26" rx="2" fill="#3b82f6" opacity="0.6"/>
        <rect x="168" y="100" width="58" height="48" rx="8" fill="white" stroke="#93c5fd" strokeWidth="1"/>
        <text x="178" y="122" fontSize="18" fill="#1d4ed8" fontWeight="800">17.8K</text>
        <text x="178" y="138" fontSize="7" fill="#6b8ccc" fontWeight="700">MICE EVENTS</text>
        {/* sync icon */}
        <text x="108" y="92" fontSize="12">🔄</text>
        <text x="164" y="92" fontSize="12">🔄</text>
      </svg>
    )
  },
  {
    id: 'save',
    icon: '💾',
    titleTh: 'บันทึกอัตโนมัติ',
    subtitleEn: 'Auto-Save & Export',
    descTh: 'ข้อมูลทุกอย่างถูกบันทึกอัตโนมัติในเบราว์เซอร์ สามารถ Export เป็น PDF หรือ Import/Export JSON ได้',
    illustration: (
      <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* browser storage */}
        <rect x="20" y="50" width="70" height="80" rx="10" fill="#f0fdf4" stroke="#86efac" strokeWidth="1.5"/>
        <text x="30" y="75" fontSize="11">🌐</text>
        <text x="28" y="92" fontSize="7" fill="#166534" fontWeight="bold">Browser</text>
        <text x="28" y="104" fontSize="7" fill="#166534" fontWeight="bold">Storage</text>
        <rect x="28" y="110" width="54" height="6" rx="3" fill="#86efac"/>
        <rect x="28" y="120" width="40" height="6" rx="3" fill="#bbf7d0"/>
        {/* auto-save badge */}
        <rect x="32" y="50" width="46" height="16" rx="8" fill="#16a34a"/>
        <text x="36" y="62" fontSize="7" fill="white" fontWeight="bold">✓ Auto-saved</text>
        {/* arrows */}
        <path d="M96 90 L118 90" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4,3" fill="none"/>
        <path d="M118 90 L96 90" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4,3" fill="none" opacity="0"/>
        {/* dashboard box */}
        <rect x="90" y="50" width="60" height="80" rx="10" fill="white" stroke="#93c5fd" strokeWidth="1.5"/>
        <rect x="98" y="60" width="44" height="26" rx="5" fill="#dbeafe"/>
        <polyline points="102,80 112,68 122,74 132,62" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <rect x="98" y="92" width="44" height="12" rx="4" fill="#eff6ff"/>
        <rect x="98" y="108" width="44" height="12" rx="4" fill="#eff6ff"/>
        {/* export */}
        <path d="M156 90 L178 80" stroke="#f59e0b" strokeWidth="2" fill="none" markerEnd="url(#arrowEx)"/>
        <path d="M156 90 L178 100" stroke="#f59e0b" strokeWidth="2" fill="none" markerEnd="url(#arrowEx2)"/>
        <defs>
          <marker id="arrowEx" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#f59e0b"/>
          </marker>
          <marker id="arrowEx2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#f59e0b"/>
          </marker>
        </defs>
        <rect x="180" y="56" width="46" height="22" rx="8" fill="#fef3c7" stroke="#fcd34d" strokeWidth="1"/>
        <text x="188" y="71" fontSize="10">📄 PDF</text>
        <rect x="180" y="84" width="46" height="22" rx="8" fill="#f0fdf4" stroke="#86efac" strokeWidth="1"/>
        <text x="186" y="99" fontSize="10">📦 JSON</text>
      </svg>
    )
  },
  {
    id: 'ready',
    icon: '🚀',
    titleTh: 'พร้อมแล้ว!',
    subtitleEn: "You're all set!",
    descTh: 'คุณรู้จัก Dashboard Builder แล้ว ลองสร้าง Dashboard แรกของคุณได้เลย! กดปุ่ม ✎ ที่มุมบนขวาเพื่อเริ่ม',
    illustration: (
      <svg viewBox="0 0 240 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* rocket */}
        <text x="95" y="90" fontSize="52">🚀</text>
        {/* stars */}
        <text x="30" y="50" fontSize="18">⭐</text>
        <text x="185" y="45" fontSize="14">✨</text>
        <text x="50" y="130" fontSize="12">✨</text>
        <text x="170" y="130" fontSize="18">⭐</text>
        <text x="140" y="35" fontSize="10">🌟</text>
        {/* confetti dots */}
        <circle cx="60" cy="70" r="4" fill="#f59e0b" opacity="0.7"/>
        <circle cx="180" cy="80" r="3" fill="#ef4444" opacity="0.7"/>
        <circle cx="45" cy="110" r="3" fill="#8b5cf6" opacity="0.7"/>
        <circle cx="195" cy="110" r="4" fill="#10b981" opacity="0.7"/>
        <circle cx="75" cy="40" r="3" fill="#3b82f6" opacity="0.7"/>
        <circle cx="165" cy="60" r="3" fill="#f97316" opacity="0.7"/>
        {/* message */}
        <rect x="50" y="125" width="140" height="26" rx="13" fill="#1d4ed8"/>
        <text x="77" y="143" fontSize="11" fill="white" fontWeight="bold">เริ่มสร้าง Dashboard!</text>
      </svg>
    )
  }
];

export default function WizardOnboarding({ onClose }) {
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [direction, setDirection] = useState('next');

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;

  const goTo = (nextStep, dir = 'next') => {
    setDirection(dir);
    setExiting(true);
    setTimeout(() => {
      setStep(nextStep);
      setExiting(false);
    }, 200);
  };

  const handleNext = () => {
    if (isLast) {
      handleDone();
    } else {
      goTo(step + 1, 'next');
    }
  };

  const handleBack = () => {
    if (step > 0) goTo(step - 1, 'back');
  };

  const handleDone = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    onClose();
  };

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    onClose();
  };

  return (
    <div className="wizard-backdrop" onClick={handleSkip}>
      <div
        className={`wizard-card ${exiting ? (direction === 'next' ? 'exit-left' : 'exit-right') : 'enter'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress dots */}
        <div className="wizard-dots">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`wizard-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
              onClick={() => goTo(i, i > step ? 'next' : 'back')}
              aria-label={`ไปขั้นตอน ${i + 1}`}
            />
          ))}
        </div>

        {/* Progress bar */}
        <div className="wizard-progress-bar">
          <div
            className="wizard-progress-fill"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        {/* Step counter */}
        <div className="wizard-step-label">
          ขั้นตอน {step + 1} / {total}
        </div>

        {/* Illustration */}
        <div className="wizard-illustration">
          {current.illustration}
        </div>

        {/* Icon + Title */}
        <div className="wizard-icon">{current.icon}</div>
        <h2 className="wizard-title">{current.titleTh}</h2>
        <p className="wizard-subtitle">{current.subtitleEn}</p>
        <p className="wizard-desc">{current.descTh}</p>

        {/* Navigation */}
        <div className="wizard-nav">
          <button
            className="wizard-btn-skip"
            onClick={handleSkip}
          >
            ข้ามทั้งหมด
          </button>
          <div className="wizard-nav-right">
            {step > 0 && (
              <button className="wizard-btn-back" onClick={handleBack}>
                ← ย้อนกลับ
              </button>
            )}
            <button className="wizard-btn-next" onClick={handleNext}>
              {isLast ? '🚀 เริ่มใช้งาน!' : 'ถัดไป →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useWizard() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      // Small delay so page renders first
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  return {
    wizardOpen: open,
    openWizard: () => setOpen(true),
    closeWizard: () => setOpen(false),
  };
}
