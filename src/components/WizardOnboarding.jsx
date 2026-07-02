import React, { useState, useEffect } from 'react';
import { useLang } from '../i18n';

const STORAGE_KEY = 'bi-dashboard.wizard-done.v1';

// แต่ละ step ใช้ i18n key prefix (wizard.s1.*, wizard.s2.*, ...) — เนื้อหา (topic/title/subtitle/bullets)
// ดึงจาก dict ตอน render; illustration ยังอยู่ที่นี่ (ไม่มีข้อความให้แปล)
const STEPS = [
  {
    id: 'welcome',
    key: 's1',
    bulletCount: 3,
    illustration: (
      <svg viewBox="0 0 260 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* canvas background */}
        <rect x="60" y="18" width="182" height="128" rx="12" fill="#f8fafc" stroke="#e5e7eb" strokeWidth="1.5"/>
        {/* grid dots */}
        {[80,110,140,170,200,230].map(x => [30,55,80,105,130].map(y => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="#d1d5db" opacity="0.8"/>
        )))}
        {/* filter panel */}
        <rect x="68" y="24" width="166" height="22" rx="6" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="76" y="30" width="36" height="10" rx="5" fill="#111111"/>
        <text x="79" y="38" fontSize="6" fill="white" fontWeight="bold">International</text>
        <rect x="116" y="30" width="22" height="10" rx="5" fill="#111111"/>
        <text x="120" y="38" fontSize="6" fill="white" fontWeight="bold">2024</text>
        <rect x="142" y="30" width="18" height="10" rx="5" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <text x="146" y="38" fontSize="6" fill="#6b7280">Q1–Q4</text>
        {/* widget 1 — KPI */}
        <rect x="68" y="52" width="50" height="44" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <text x="76" y="70" fontSize="16" fill="#111111" fontWeight="800">84K</text>
        <text x="76" y="80" fontSize="6" fill="#6b7280">MICE Visitors</text>
        <text x="76" y="90" fontSize="7" fill="#6b7280">▲ 12.3%</text>
        {/* widget 2 — bar */}
        <rect x="124" y="52" width="56" height="44" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="132" y="82" width="8" height="10" rx="2" fill="#9ca3af" opacity="0.8"/>
        <rect x="144" y="74" width="8" height="18" rx="2" fill="#111111"/>
        <rect x="156" y="78" width="8" height="14" rx="2" fill="#9ca3af" opacity="0.8"/>
        <rect x="168" y="68" width="8" height="24" rx="2" fill="#111111"/>
        {/* widget 3 — line */}
        <rect x="186" y="52" width="56" height="44" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <polyline points="194,88 202,74 212,80 222,66 232,72" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* widget 4 — table */}
        <rect x="68" y="102" width="174" height="36" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="68" y="102" width="174" height="11" rx="7" fill="#f3f4f6"/>
        <rect x="68" y="107" width="174" height="6" rx="0" fill="#f3f4f6"/>
        <text x="76" y="111" fontSize="6" fill="#111111" fontWeight="bold">Nationality</text>
        <text x="130" y="111" fontSize="6" fill="#111111" fontWeight="bold">Visitors</text>
        <text x="180" y="111" fontSize="6" fill="#111111" fontWeight="bold">%Growth</text>
        <rect x="76" y="118" width="40" height="4" rx="2" fill="#e5e7eb"/>
        <rect x="130" y="118" width="24" height="4" rx="2" fill="#e5e7eb"/>
        <rect x="180" y="118" width="20" height="4" rx="2" fill="#d1d5db"/>
        <rect x="76" y="126" width="32" height="4" rx="2" fill="#e5e7eb"/>
        <rect x="130" y="126" width="18" height="4" rx="2" fill="#e5e7eb"/>
        <rect x="180" y="126" width="14" height="4" rx="2" fill="#d1d5db"/>
        {/* palette sidebar hint */}
        <rect x="14" y="18" width="40" height="128" rx="10" fill="#f3f4f6" stroke="#e5e7eb" strokeWidth="1.5"/>
        <rect x="20" y="28" width="28" height="18" rx="5" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="20" y="50" width="28" height="18" rx="5" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="20" y="72" width="28" height="18" rx="5" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1"/>
        <text x="25" y="40" fontSize="9">📊</text>
        <text x="25" y="62" fontSize="9">📋</text>
        <text x="25" y="84" fontSize="9">🔢</text>
      </svg>
    ),
  },
  {
    id: 'palette',
    key: 's2',
    bulletCount: 3,
    illustration: (
      <svg viewBox="0 0 260 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="cp-palette-panel">
            <rect x="20" y="14" width="112" height="138" rx="10"/>
          </clipPath>
          <clipPath id="cp-folder1-header">
            <rect x="26" y="36" width="82" height="22"/>
          </clipPath>
          <clipPath id="cp-folder1-body">
            <rect x="26" y="58" width="88" height="54"/>
          </clipPath>
          <marker id="aw1p" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
        <path d="M0,0 L0,5 L5,2.5 z" fill="#111111"/>
          </marker>
        </defs>
        {/* palette panel */}
        <rect x="20" y="14" width="112" height="138" rx="10" fill="#f8fafc" stroke="#e5e7eb" strokeWidth="1.5"/>
        {/* title */}
        <text x="30" y="30" fontSize="8" fill="#111111" fontWeight="bold">Widget Palette</text>
        {/* folder 1 — open */}
        <rect x="26" y="36" width="100" height="76" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        {/* folder header — clipped */}
        <rect x="26" y="36" width="100" height="22" rx="7" fill="#f3f4f6"/>
        <rect x="26" y="47" width="100" height="11" rx="0" fill="#f3f4f6"/>
        <g clipPath="url(#cp-folder1-header)">
          <text x="33" y="51" fontSize="7">📁</text>
          <text x="43" y="51" fontSize="6.5" fill="#111111" fontWeight="bold">Stat Performance</text>
        </g>
        <text x="117" y="51" fontSize="8" fill="#6b7280">∨</text>
        {/* items inside — clipped */}
        <g clipPath="url(#cp-folder1-body)">
          <rect x="32" y="62" width="88" height="13" rx="4" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="0.8"/>
          <text x="38" y="72" fontSize="6.5" fill="#374151">■ Visitors KPI Card</text>
          <rect x="32" y="78" width="88" height="13" rx="4" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="0.8"/>
          <text x="38" y="88" fontSize="6.5" fill="#374151">■ Revenue KPI Card</text>
          <rect x="32" y="94" width="88" height="13" rx="4" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="0.8"/>
          <text x="38" y="104" fontSize="6.5" fill="#374151">■ Events KPI Card</text>
        </g>
        {/* folder 2 — closed */}
        <rect x="26" y="118" width="100" height="20" rx="7" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
        <text x="33" y="131" fontSize="7">📁</text>
        <text x="43" y="131" fontSize="6.5" fill="#6b7280" fontWeight="bold">Trends</text>
        <text x="117" y="131" fontSize="8" fill="#6b7280">›</text>
        {/* folder 3 — closed */}
        <rect x="26" y="142" width="100" height="8" rx="4" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.8"/>
        <text x="43" y="149" fontSize="5.5" fill="#9ca3af">Configurable</text>
        {/* annotation 1 */}
        <rect x="144" y="38" width="104" height="50" rx="8" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1.2"/>
        <text x="154" y="56" fontSize="8" fill="#111111" fontWeight="bold">💡 Folders</text>
        <text x="154" y="69" fontSize="6.5" fill="#6b7280">Click the folder header</text>
        <text x="154" y="80" fontSize="6.5" fill="#6b7280">to expand / collapse.</text>
        <path d="M128 51 L142 51" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="3,2" markerEnd="url(#aw1p)"/>
        {/* annotation 2 */}
        <rect x="144" y="98" width="104" height="44" rx="8" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1.2"/>
        <text x="154" y="115" fontSize="8" fill="#111111" fontWeight="bold">✓ Ready-to-use</text>
        <text x="154" y="128" fontSize="6.5" fill="#6b7280">No setup required.</text>
        <text x="154" y="138" fontSize="6.5" fill="#6b7280">Connects to MICE data.</text>
      </svg>
    ),
  },
  {
    id: 'drag',
    key: 's3',
    bulletCount: 3,
    illustration: (
      <svg viewBox="0 0 260 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="cp-pal-item">
            <rect x="18" y="20" width="52" height="120"/>
          </clipPath>
          <marker id="aw2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
          <path d="M0,0 L0,5 L5,2.5 z" fill="#111111"/>
          </marker>
        </defs>
        {/* palette */}
        <rect x="10" y="20" width="68" height="120" rx="10" fill="#f8fafc" stroke="#e5e7eb" strokeWidth="1.5"/>
        <rect x="18" y="30" width="52" height="22" rx="6" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="18" y="56" width="52" height="22" rx="6" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1"/>
        {/* highlighted source widget */}
        <rect x="18" y="82" width="52" height="22" rx="6" fill="#111111" stroke="#111111" strokeWidth="1.5"/>
        <g clipPath="url(#cp-pal-item)">
          <text x="24" y="95" fontSize="7" fill="white" fontWeight="bold">Events Bar</text>
        </g>
        <rect x="18" y="108" width="52" height="22" rx="6" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1"/>
        {/* step badge 1 */}
        <rect x="6" y="79" width="14" height="14" rx="7" fill="#111111"/>
        <text x="10" y="89" fontSize="8" fill="white" fontWeight="bold">1</text>
        {/* canvas */}
        <rect x="92" y="20" width="160" height="120" rx="10" fill="#f8fafc" stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="6,4"/>
        <text x="148" y="136" fontSize="7" fill="#9ca3af">Canvas</text>
        {/* ghost drop target */}
        <rect x="104" y="52" width="90" height="56" rx="8" fill="#f3f4f6" stroke="#111111" strokeWidth="2" strokeDasharray="5,3" opacity="0.9"/>
        <text x="124" y="82" fontSize="7.5" fill="#111111" fontWeight="bold">Drop here ↓</text>
        {/* step badge 3 */}
        <rect x="196" y="86" width="14" height="14" rx="7" fill="#111111"/>
        <text x="200" y="96" fontSize="8" fill="white" fontWeight="bold">3</text>
        {/* cursor + dragged widget ghost */}
        <rect x="108" y="30" width="64" height="36" rx="7" fill="white" stroke="#111111" strokeWidth="2" opacity="0.9"/>
        <rect x="114" y="36" width="8" height="16" rx="2" fill="#9ca3af" opacity="0.8"/>
        <rect x="126" y="40" width="8" height="12" rx="2" fill="#111111"/>
        <rect x="138" y="38" width="8" height="14" rx="2" fill="#9ca3af" opacity="0.8"/>
        <rect x="150" y="34" width="8" height="18" rx="2" fill="#111111"/>
        <text x="137" y="73" fontSize="15">🤚</text>
        {/* step badge 2 */}
        <rect x="130" y="26" width="14" height="14" rx="7" fill="#111111"/>
        <text x="134" y="36" fontSize="8" fill="white" fontWeight="bold">2</text>
        {/* dashed trail */}
        <path d="M46 93 Q80 88 108 56" stroke="#111111" strokeWidth="1.5" strokeDasharray="4,3" fill="none" opacity="0.5"/>
      </svg>
    ),
  },
  {
    id: 'resize',
    key: 's4',
    bulletCount: 3,
    illustration: (
      <svg viewBox="0 0 260 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* canvas */}
        <rect x="14" y="14" width="232" height="138" rx="12" fill="#f8fafc" stroke="#e5e7eb" strokeWidth="1.5"/>
        {/* grid dots */}
        {[32,58,84,110,136,162,188,214,234].map(x => [28,48,68,88,108,128,148].map(y => (
          <circle key={`g${x}-${y}`} cx={x} cy={y} r="1" fill="#e5e7eb"/>
        )))}
        {/* widget being moved — with cursor */}
        <rect x="24" y="24" width="100" height="58" rx="7" fill="white" stroke="#111111" strokeWidth="2"/>
        <rect x="24" y="24" width="100" height="14" rx="7" fill="#f3f4f6"/>
        <rect x="24" y="31" width="100" height="7" rx="0" fill="#f3f4f6"/>
        <text x="30" y="34" fontSize="7" fill="#111111" fontWeight="bold">Revenue Chart</text>
        <polyline points="34,70 48,52 62,60 78,44 94,54 108,40 118,48" stroke="#111111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* move cursor on header */}
        <text x="95" y="33" fontSize="10">✋</text>
        {/* move annotation */}
        <rect x="22" y="87" width="82" height="26" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1"/>
        <text x="30" y="100" fontSize="7" fill="#111111" fontWeight="bold">Drag header to move</text>
        <path d="M55" y="88" />
        {/* resize widget */}
        <rect x="136" y="24" width="100" height="100" rx="7" fill="white" stroke="#9ca3af" strokeWidth="1.5"/>
        <rect x="136" y="24" width="100" height="14" rx="7" fill="#f3f4f6"/>
        <rect x="136" y="31" width="100" height="7" rx="0" fill="#f3f4f6"/>
        <text x="142" y="34" fontSize="7" fill="#111111" fontWeight="bold">Visitors Bar</text>
        <rect x="144" y="44" width="12" height="60" rx="3" fill="#9ca3af" opacity="0.8"/>
        <rect x="162" y="56" width="12" height="48" rx="3" fill="#111111"/>
        <rect x="180" y="50" width="12" height="54" rx="3" fill="#9ca3af" opacity="0.8"/>
        <rect x="198" y="38" width="12" height="66" rx="3" fill="#111111"/>
        {/* resize handle */}
        <rect x="225" y="113" width="14" height="10" rx="3" fill="#111111"/>
        <text x="228" y="121" fontSize="8" fill="white">↔</text>
        <text x="224" y="137" fontSize="10">↙</text>
        {/* resize annotation */}
        <rect x="148" y="128" width="88" height="22" rx="6" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1"/>
        <text x="154" y="143" fontSize="7" fill="#111111" fontWeight="bold">Drag corner to resize</text>
      </svg>
    ),
  },
  {
    id: 'filters',
    key: 's5',
    bulletCount: 3,
    illustration: (
      <svg viewBox="0 0 260 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* filter panel */}
        <rect x="14" y="14" width="232" height="44" rx="8" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1.5"/>
        <text x="22" y="28" fontSize="7" fill="#111111" fontWeight="bold">FILTER PANEL</text>
        {/* market chips */}
        <rect x="22" y="32" width="52" height="14" rx="7" fill="#111111"/>
        <text x="28" y="42" fontSize="6.5" fill="white" fontWeight="bold">International</text>
        <rect x="78" y="32" width="36" height="14" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <text x="84" y="42" fontSize="6.5" fill="#6b7280">Domestic</text>
        {/* year chip */}
        <rect x="122" y="32" width="26" height="14" rx="7" fill="#111111"/>
        <text x="127" y="42" fontSize="6.5" fill="white" fontWeight="bold">2024</text>
        {/* quarter chips */}
        <rect x="154" y="32" width="16" height="14" rx="7" fill="#111111"/>
        <text x="158" y="42" fontSize="6.5" fill="white" fontWeight="bold">Q1</text>
        <rect x="174" y="32" width="16" height="14" rx="7" fill="#111111"/>
        <text x="178" y="42" fontSize="6.5" fill="white" fontWeight="bold">Q2</text>
        <rect x="194" y="32" width="16" height="14" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <text x="198" y="42" fontSize="6.5" fill="#6b7280">Q3</text>
        <rect x="214" y="32" width="16" height="14" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <text x="218" y="42" fontSize="6.5" fill="#6b7280">Q4</text>
        {/* arrows down */}
        <path d="M60 60 L60 72" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#awd1)" strokeDasharray="3,2"/>
        <path d="M130 60 L130 72" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#awd2)" strokeDasharray="3,2"/>
        <path d="M200 60 L200 72" stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#awd3)" strokeDasharray="3,2"/>
        <defs>
          <marker id="awd1" markerWidth="5" markerHeight="5" refX="2.5" refY="4.5" orient="auto">
            <path d="M0,0 L5,0 L2.5,5 z" fill="#111111"/>
          </marker>
          <marker id="awd2" markerWidth="5" markerHeight="5" refX="2.5" refY="4.5" orient="auto">
            <path d="M0,0 L5,0 L2.5,5 z" fill="#111111"/>
          </marker>
          <marker id="awd3" markerWidth="5" markerHeight="5" refX="2.5" refY="4.5" orient="auto">
            <path d="M0,0 L5,0 L2.5,5 z" fill="#111111"/>
          </marker>
        </defs>
        {/* widgets updating */}
        <rect x="14" y="74" width="68" height="48" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <polyline points="22,110 32,94 44,102 58,86 70,96 78,82" stroke="#111111" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <rect x="88" y="74" width="68" height="48" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="96" y="96" width="10" height="18" rx="2" fill="#9ca3af" opacity="0.8"/>
        <rect x="110" y="90" width="10" height="24" rx="2" fill="#111111"/>
        <rect x="124" y="94" width="10" height="20" rx="2" fill="#9ca3af" opacity="0.8"/>
        <rect x="138" y="84" width="10" height="30" rx="2" fill="#111111"/>
        <rect x="162" y="74" width="68" height="48" rx="7" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <text x="170" y="100" fontSize="20" fill="#111111" fontWeight="800">84K</text>
        <text x="170" y="114" fontSize="6" fill="#6b7280" fontWeight="bold">MICE VISITORS</text>
        {/* sync badges */}
        <rect x="24" y="118" width="50" height="10" rx="5" fill="#111111" opacity="0.9"/>
        <text x="32" y="126" fontSize="6" fill="white" fontWeight="bold">Updated</text>
        <rect x="98" y="118" width="50" height="10" rx="5" fill="#111111" opacity="0.9"/>
        <text x="106" y="126" fontSize="6" fill="white" fontWeight="bold">Updated</text>
        <rect x="172" y="118" width="50" height="10" rx="5" fill="#111111" opacity="0.9"/>
        <text x="180" y="126" fontSize="6" fill="white" fontWeight="bold">Updated</text>
        {/* bottom label */}
        <rect x="58" y="128" width="144" height="16" rx="8" fill="#111111"/>
        <text x="76" y="139" fontSize="7" fill="white" fontWeight="bold">All widgets update together</text>
      </svg>
    ),
  },
  {
    id: 'configure',
    key: 's6',
    bulletCount: 3,
    illustration: (
      <svg viewBox="0 0 260 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* widget */}
        <rect x="14" y="20" width="148" height="126" rx="10" fill="white" stroke="#111111" strokeWidth="2"/>
        <rect x="14" y="20" width="148" height="24" rx="10" fill="#edf2f7"/>
        <rect x="14" y="33" width="148" height="11" rx="0" fill="#edf2f7"/>
        <text x="24" y="36" fontSize="8" fill="#111111" fontWeight="bold">MICE Events Chart</text>
        {/* gear button highlighted */}
        <circle cx="144" cy="32" r="12" fill="#111111"/>
        <text x="139" y="36" fontSize="11" fill="white">⚙</text>
        <circle cx="144" cy="32" r="18" stroke="#d1d5db" strokeWidth="1.5" opacity="0.95" strokeDasharray="3,3"/>
        {/* chart */}
        <polyline points="28,126 42,100 58,110 76,82 94,96 114,68 132,80 152,60" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.95"/>
        {/* hover label */}
        <rect x="26" y="56" width="82" height="16" rx="8" fill="#111111" opacity="0.95"/>
        <text x="34" y="67" fontSize="7" fill="white" fontWeight="bold">Hover → click ⚙</text>
        {/* config panel */}
        <rect x="174" y="14" width="78" height="136" rx="10" fill="#f8fafc" stroke="#d1d5db" strokeWidth="1.5"/>
        <defs>
          <clipPath id="cp-cfg-panel">
            <rect x="176" y="14" width="74" height="136"/>
          </clipPath>
        </defs>
        <g clipPath="url(#cp-cfg-panel)">
          <text x="182" y="30" fontSize="7" fill="#111111" fontWeight="bold">⚙ Settings</text>
          {/* fields */}
          <text x="182" y="46" fontSize="6" fill="#6b7280">Chart Type</text>
          <rect x="182" y="50" width="62" height="12" rx="4" fill="white" stroke="#d1d5db" strokeWidth="1"/>
          <text x="187" y="59" fontSize="6.5" fill="#374151">Bar Chart  ∨</text>
          <text x="182" y="74" fontSize="6" fill="#6b7280">X-Axis</text>
          <rect x="182" y="78" width="62" height="12" rx="4" fill="white" stroke="#d1d5db" strokeWidth="1"/>
          <text x="187" y="87" fontSize="6.5" fill="#374151">year  ∨</text>
          <text x="182" y="102" fontSize="6" fill="#6b7280">Y-Axis</text>
          <rect x="182" y="106" width="62" height="12" rx="4" fill="white" stroke="#d1d5db" strokeWidth="1"/>
          <text x="187" y="115" fontSize="6.5" fill="#374151">no_of_events  ∨</text>
          <rect x="182" y="124" width="62" height="18" rx="6" fill="#111111"/>
          <text x="198" y="136" fontSize="8" fill="white" fontWeight="bold">Apply</text>
        </g>
        {/* arrow connector */}
        <path d="M160 32 L172 32" stroke="#9ca3af" strokeWidth="2" fill="none" markerEnd="url(#aw3)"/>
        <defs>
          <marker id="aw3" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
            <path d="M0,0 L0,5 L5,2.5 z" fill="#111111"/>
          </marker>
        </defs>
      </svg>
    ),
  },
  {
    id: 'preview',
    key: 's7',
    bulletCount: 3,
    illustration: (
      <svg viewBox="0 0 260 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* toolbar strip */}
        <rect x="14" y="14" width="232" height="28" rx="8" fill="#111111"/>
        <text x="22" y="32" fontSize="8" fill="white">Data Hub สร้างแดชบอร์ด</text>
        {/* toolbar buttons right */}
        <rect x="190" y="19" width="20" height="18" rx="5" fill="white" opacity="0.15"/>
        <text x="194" y="31" fontSize="10" fill="white">📄</text>
        <rect x="214" y="19" width="20" height="18" rx="5" fill="white" opacity="0.3"/>
        <text x="218" y="31" fontSize="10" fill="white">◐</text>
        {/* edit mode left panel */}
        <rect x="14" y="48" width="118" height="104" rx="8" fill="#f8fafc" stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="5,3"/>
        <text x="26" y="64" fontSize="7" fill="#6b7280" fontWeight="bold">EDIT MODE</text>
        <rect x="22" y="70" width="96" height="36" rx="6" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="22" y="112" width="44" height="32" rx="6" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="70" y="112" width="48" height="32" rx="6" fill="white" stroke="#d1d5db" strokeWidth="1"/>
        {/* grid corners visible in edit */}
        <circle cx="26" cy="74" r="2" fill="#d1d5db"/>
        <circle cx="114" cy="74" r="2" fill="#d1d5db"/>
        {/* preview mode right panel */}
        <rect x="140" y="48" width="106" height="104" rx="8" fill="white" stroke="#111111" strokeWidth="2"/>
        <text x="152" y="64" fontSize="7" fill="#111111" fontWeight="bold">PREVIEW MODE</text>
        <rect x="148" y="70" width="90" height="36" rx="6" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
        <polyline points="156,96 168,82 182,88 196,72 210,80 226,66" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <rect x="148" y="112" width="42" height="32" rx="6" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
        <text x="154" y="128" fontSize="18" fill="#111111" fontWeight="800">84K</text>
        <rect x="196" y="112" width="42" height="32" rx="6" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1"/>
        {/* export badges */}
        <rect x="14" y="148" width="54" height="12" rx="6" fill="#111111" opacity="0.9"/>
        <text x="20" y="157" fontSize="6.5" fill="white" fontWeight="bold">PDF Export</text>
        <rect x="72" y="148" width="58" height="12" rx="6" fill="#111111" opacity="0.9"/>
        <text x="78" y="157" fontSize="6.5" fill="white" fontWeight="bold">JSON Export</text>
      </svg>
    ),
  },
  {
    id: 'ready',
    key: 's8',
    bulletCount: 3,
    illustration: (
      <svg viewBox="0 0 260 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <text x="95" y="95" fontSize="56">🚀</text>
        <text x="30" y="52" fontSize="20">⭐</text>
        <text x="200" y="46" fontSize="14">✨</text>
        <text x="50" y="134" fontSize="12">✨</text>
        <text x="182" y="134" fontSize="18">⭐</text>
        <text x="148" y="36" fontSize="10">🌟</text>
        <circle cx="62" cy="72" r="4" fill="#9ca3af" opacity="0.7"/>
        <circle cx="190" cy="82" r="3" fill="#9ca3af" opacity="0.7"/>
        <circle cx="46" cy="112" r="3" fill="#9ca3af" opacity="0.7"/>
        <circle cx="204" cy="112" r="4" fill="#9ca3af" opacity="0.7"/>
        <circle cx="78" cy="42" r="3" fill="#9ca3af" opacity="0.7"/>
        <circle cx="172" cy="62" r="3" fill="#9ca3af" opacity="0.7"/>
        <rect x="50" y="126" width="160" height="26" rx="13" fill="#111111"/>
        <text x="76" y="144" fontSize="11" fill="white" fontWeight="bold">Start Building →</text>
      </svg>
    ),
  },
];

export default function WizardOnboarding({ onClose }) {
  const { t } = useLang();
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [direction, setDirection] = useState('next');

  const total = STEPS.length;
  const current = STEPS[step];
  const isLast = step === total - 1;
  const bullets = Array.from({ length: current.bulletCount }, (_, i) => t(`wizard.${current.key}.b${i + 1}`));

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
        {/* Topic badge */}
        <div className="wizard-topic-badge">{t(`wizard.${current.key}.topic`)}</div>

        {/* Progress dots */}
        <div className="wizard-dots">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`wizard-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
              onClick={() => goTo(i, i > step ? 'next' : 'back')}
              aria-label={t('wizard.goStep', { n: i + 1 })}
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
          {step + 1} / {total}
        </div>

        {/* Illustration */}
        <div className="wizard-illustration">
          {current.illustration}
        </div>

        {/* Title */}
        <h2 className="wizard-title">{t(`wizard.${current.key}.title`)}</h2>
        <p className="wizard-subtitle">{t(`wizard.${current.key}.subtitle`)}</p>

        {/* Bullet list */}
        <ul className="wizard-bullets">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>

        {/* Navigation */}
        <div className="wizard-nav">
          <button className="wizard-btn-skip" onClick={handleSkip}>
            {t('wizard.skip')}
          </button>
          <div className="wizard-nav-right">
            {step > 0 && (
              <button className="wizard-btn-back" onClick={handleBack}>
                {t('wizard.back')}
              </button>
            )}
            <button className="wizard-btn-next" onClick={handleNext}>
              {isLast ? t('wizard.done') : t('wizard.next')}
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
