#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const CATEGORY_DIR = path.resolve(__dirname, '..', 'assets', 'images', 'categories');
if (!fs.existsSync(CATEGORY_DIR)) {
  fs.mkdirSync(CATEGORY_DIR, { recursive: true });
}

// Visual Identity:
// Primary orange: #F28C28
// Secondary orange: #FF9F43
// Deep background: #171717
// Light background: #FFF7ED
// Glass surface: rgba(255,255,255,0.10)
// Glass border: rgba(255,255,255,0.20)
// Professional editorial quality, zero text inside images

const sharedDefs = `
  <defs>
    <linearGradient id="primaryGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#F28C28"/>
      <stop offset="100%" stop-color="#FF9F43"/>
    </linearGradient>
    <linearGradient id="warmGrad" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0%" stop-color="#E65100"/>
      <stop offset="50%" stop-color="#F28C28"/>
      <stop offset="100%" stop-color="#FFB74D"/>
    </linearGradient>
    <linearGradient id="darkBg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#171717"/>
      <stop offset="60%" stop-color="#1e1814"/>
      <stop offset="100%" stop-color="#14110e"/>
    </linearGradient>
    <radialGradient id="radialAmber" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF9F43" stop-opacity="0.5"/>
      <stop offset="60%" stop-color="#F28C28" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#171717" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cornerGlow" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="#FF9F43" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#171717" stop-opacity="0"/>
    </radialGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
`;

const images = {
  // 1. Technology & AI (3 images)
  'tech-ai-1.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Technology and AI neural network nodes and geometric structures">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="600" cy="400" r="380" fill="url(#radialAmber)"/>
  <circle cx="950" cy="180" r="300" fill="url(#cornerGlow)"/>
  <!-- Neural lattice -->
  <g stroke="rgba(255,159,67,0.22)" stroke-width="1.5">
    <line x1="200" y1="600" x2="360" y2="420"/>
    <line x1="360" y1="420" x2="520" y2="480"/>
    <line x1="360" y1="420" x2="480" y2="280"/>
    <line x1="480" y1="280" x2="680" y2="240"/>
    <line x1="520" y1="480" x2="720" y2="460"/>
    <line x1="680" y1="240" x2="840" y2="340"/>
    <line x1="720" y1="460" x2="840" y2="340"/>
    <line x1="840" y1="340" x2="1020" y2="240"/>
    <line x1="720" y1="460" x2="900" y2="580"/>
  </g>
  <!-- Glass polygons -->
  <polygon points="360,420 480,280 680,240 520,480" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
  <polygon points="520,480 680,240 840,340 720,460" fill="rgba(242,140,40,0.12)" stroke="rgba(255,159,67,0.4)" stroke-width="2"/>
  <polygon points="680,240 840,340 1020,240 880,160" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
  <!-- Glowing nodes -->
  <circle cx="360" cy="420" r="14" fill="#F28C28" filter="url(#softGlow)"/>
  <circle cx="480" cy="280" r="10" fill="#FF9F43"/>
  <circle cx="680" cy="240" r="18" fill="url(#primaryGrad)" filter="url(#softGlow)"/>
  <circle cx="520" cy="480" r="12" fill="#FF9F43"/>
  <circle cx="720" cy="460" r="16" fill="#F28C28" filter="url(#softGlow)"/>
  <circle cx="840" cy="340" r="22" fill="url(#warmGrad)" filter="url(#softGlow)"/>
  <circle cx="1020" cy="240" r="14" fill="#FF9F43"/>
  <circle cx="900" cy="580" r="10" fill="#F28C28"/>
  <!-- Outer glass rings -->
  <circle cx="840" cy="340" r="64" fill="none" stroke="rgba(255,159,67,0.3)" stroke-width="2" stroke-dasharray="6 8"/>
  <circle cx="680" cy="240" r="48" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
</svg>`,

  'tech-ai-2.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Microchip architecture and algorithmic quantum layers">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="700" cy="360" r="360" fill="url(#radialAmber)"/>
  <!-- Circuit grid lines -->
  <g stroke="rgba(242,140,40,0.18)" stroke-width="2" stroke-linecap="round">
    <path d="M 150 400 L 350 400 L 450 300 L 650 300"/>
    <path d="M 200 550 L 400 550 L 500 450 L 700 450"/>
    <path d="M 300 200 L 500 200 L 580 280 L 780 280"/>
    <path d="M 750 300 L 850 200 L 1050 200"/>
    <path d="M 800 450 L 900 350 L 1080 350"/>
    <path d="M 720 580 L 880 580 L 960 500 L 1100 500"/>
  </g>
  <!-- Concentric angled glass tiles -->
  <rect x="440" y="220" width="320" height="320" rx="28" transform="rotate(45 600 380)" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <rect x="470" y="250" width="260" height="260" rx="20" transform="rotate(45 600 380)" fill="rgba(242,140,40,0.1)" stroke="rgba(255,159,67,0.4)" stroke-width="2.5"/>
  <rect x="510" y="290" width="180" height="180" rx="14" transform="rotate(45 600 380)" fill="url(#primaryGrad)" opacity="0.85" filter="url(#softGlow)"/>
  <!-- Micro chip core -->
  <rect x="550" y="330" width="100" height="100" rx="10" transform="rotate(45 600 380)" fill="#171717" stroke="#FFF7ED" stroke-width="2"/>
  <circle cx="600" cy="380" r="12" fill="#FFF7ED"/>
  <!-- Circuit terminal dots -->
  <circle cx="150" cy="400" r="6" fill="#F28C28"/>
  <circle cx="200" cy="550" r="6" fill="#FF9F43"/>
  <circle cx="1050" cy="200" r="8" fill="#F28C28" filter="url(#softGlow)"/>
  <circle cx="1080" cy="350" r="7" fill="#FF9F43"/>
</svg>`,

  'tech-ai-3.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Futuristic geometric refractive glass prism dispersing algorithmic light">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="550" cy="400" r="400" fill="url(#radialAmber)"/>
  <!-- Isometric glass prism -->
  <polygon points="600,140 850,280 850,560 600,420" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
  <polygon points="600,140 350,280 350,560 600,420" fill="rgba(242,140,40,0.18)" stroke="rgba(255,159,67,0.5)" stroke-width="2"/>
  <polygon points="350,560 600,420 850,560 600,700" fill="rgba(23,23,23,0.7)" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
  <!-- Light beams traversing through prism -->
  <path d="M 100 380 L 480 350 L 720 280 L 1100 180" fill="none" stroke="url(#primaryGrad)" stroke-width="6" opacity="0.9" filter="url(#softGlow)"/>
  <path d="M 100 400 L 480 350 L 750 380 L 1100 340" fill="none" stroke="#FF9F43" stroke-width="4" opacity="0.8"/>
  <path d="M 100 420 L 480 350 L 780 480 L 1100 520" fill="none" stroke="#F28C28" stroke-width="5" opacity="0.85" filter="url(#softGlow)"/>
  <!-- Internal floating refractions -->
  <circle cx="480" cy="350" r="16" fill="#FFF7ED" filter="url(#softGlow)"/>
  <circle cx="720" cy="280" r="12" fill="#FF9F43"/>
  <circle cx="750" cy="380" r="10" fill="#FFF7ED"/>
  <circle cx="780" cy="480" r="14" fill="#F28C28"/>
</svg>`,

  // 2. Business & Finance (3 images)
  'business-finance-1.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Ascending geometric business metrics and financial glass pedestals">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="650" cy="380" r="380" fill="url(#radialAmber)"/>
  <!-- Grid backdrop -->
  <g stroke="rgba(255,255,255,0.06)" stroke-width="1">
    <line x1="100" y1="620" x2="1100" y2="620"/>
    <line x1="100" y1="480" x2="1100" y2="480"/>
    <line x1="100" y1="340" x2="1100" y2="340"/>
    <line x1="100" y1="200" x2="1100" y2="200"/>
  </g>
  <!-- 3D Glass volumetric bars -->
  <!-- Bar 1 -->
  <polygon points="220,620 220,460 280,420 280,580" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
  <polygon points="280,420 360,450 360,610 280,580" fill="rgba(242,140,40,0.12)" stroke="rgba(242,140,40,0.3)" stroke-width="1.5"/>
  <polygon points="220,460 300,490 360,450 280,420" fill="rgba(255,255,255,0.12)"/>
  <!-- Bar 2 -->
  <polygon points="420,620 420,360 480,320 480,580" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="1.5"/>
  <polygon points="480,320 560,350 560,610 480,580" fill="rgba(242,140,40,0.2)" stroke="rgba(242,140,40,0.4)" stroke-width="1.5"/>
  <polygon points="420,360 500,390 560,350 480,320" fill="rgba(255,255,255,0.16)"/>
  <!-- Bar 3 -->
  <polygon points="620,620 620,260 680,220 680,580" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
  <polygon points="680,220 760,250 760,610 680,580" fill="rgba(242,140,40,0.28)" stroke="rgba(255,159,67,0.5)" stroke-width="2"/>
  <polygon points="620,260 700,290 760,250 680,220" fill="rgba(255,255,255,0.2)"/>
  <!-- Bar 4 (Peak) -->
  <polygon points="820,620 820,160 880,120 880,580" fill="rgba(242,140,40,0.2)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  <polygon points="880,120 960,150 960,610 880,580" fill="url(#primaryGrad)" opacity="0.9" stroke="rgba(255,159,67,0.7)" stroke-width="2" filter="url(#softGlow)"/>
  <polygon points="820,160 900,190 960,150 880,120" fill="#FFF7ED" opacity="0.9"/>
  <!-- Ascending trend ribbon -->
  <path d="M 180 520 Q 380 440 500 340 T 880 120 T 1060 80" fill="none" stroke="url(#warmGrad)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)"/>
  <circle cx="880" cy="120" r="16" fill="#FFF7ED" filter="url(#softGlow)"/>
  <circle cx="1060" cy="80" r="12" fill="#FF9F43"/>
</svg>`,

  'business-finance-2.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Modern liquidity rings and asset circulation mechanics">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="600" cy="400" r="360" fill="url(#radialAmber)"/>
  <!-- Orbiting interlocking glass rings -->
  <g transform="translate(600, 400)">
    <ellipse cx="0" cy="0" rx="340" ry="140" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2" transform="rotate(-25)"/>
    <ellipse cx="0" cy="0" rx="340" ry="140" fill="none" stroke="url(#primaryGrad)" stroke-width="4" stroke-dasharray="140 40 80 40" transform="rotate(35)" filter="url(#softGlow)"/>
    <ellipse cx="0" cy="0" rx="220" ry="90" fill="rgba(242,140,40,0.08)" stroke="rgba(255,159,67,0.4)" stroke-width="2.5" transform="rotate(-60)"/>
    <!-- Central vault diamond -->
    <polygon points="0,-90 80,0 0,90 -80,0" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <polygon points="0,-60 54,0 0,60 -54,0" fill="url(#primaryGrad)" filter="url(#softGlow)"/>
    <circle cx="0" cy="0" r="16" fill="#FFF7ED"/>
    <!-- Node satellites -->
    <circle cx="260" cy="-80" r="14" fill="#FF9F43" filter="url(#softGlow)"/>
    <circle cx="-240" cy="110" r="18" fill="#F28C28" filter="url(#softGlow)"/>
    <circle cx="120" cy="180" r="10" fill="#FFF7ED"/>
    <circle cx="-160" cy="-150" r="12" fill="#FF9F43"/>
  </g>
</svg>`,

  'business-finance-3.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Strategic balance and structured enterprise capital growth">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="580" cy="380" r="370" fill="url(#radialAmber)"/>
  <!-- Isometric stepped platform base -->
  <polygon points="600,640 920,480 600,320 280,480" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.16)" stroke-width="1.5"/>
  <polygon points="600,560 840,440 600,320 360,440" fill="rgba(242,140,40,0.1)" stroke="rgba(242,140,40,0.3)" stroke-width="2"/>
  <polygon points="600,480 760,400 600,320 440,400" fill="rgba(255,255,255,0.08)" stroke="rgba(255,159,67,0.4)" stroke-width="2"/>
  <!-- Central monolithic beacon -->
  <polygon points="560,420 560,180 600,150 600,390" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
  <polygon points="600,150 640,180 640,420 600,390" fill="url(#primaryGrad)" stroke="rgba(255,159,67,0.6)" stroke-width="2" filter="url(#softGlow)"/>
  <polygon points="560,180 600,150 640,180 600,210" fill="#FFF7ED"/>
  <!-- Floating balanced spheres -->
  <circle cx="440" cy="280" r="32" fill="url(#primaryGrad)" filter="url(#softGlow)"/>
  <circle cx="760" cy="280" r="28" fill="rgba(255,255,255,0.12)" stroke="rgba(255,159,67,0.5)" stroke-width="2"/>
  <circle cx="600" cy="110" r="16" fill="#FFF7ED" filter="url(#softGlow)"/>
  <circle cx="340" cy="420" r="12" fill="#FF9F43"/>
  <circle cx="860" cy="420" r="14" fill="#F28C28"/>
</svg>`,

  // 3. Education & Careers (3 images)
  'education-careers-1.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Layered knowledge steps and illumination pathway">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="600" cy="380" r="380" fill="url(#radialAmber)"/>
  <!-- Unfolding stepped knowledge leaves / books -->
  <g transform="translate(600, 480)">
    <path d="M 0 0 C 140 -80 280 -60 380 40 L 380 120 C 280 20 140 0 0 80 Z" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <path d="M 0 0 C -140 -80 -280 -60 -380 40 L -380 120 C -280 20 -140 0 0 80 Z" fill="rgba(242,140,40,0.12)" stroke="rgba(242,140,40,0.3)" stroke-width="2"/>
    <path d="M 0 -70 C 120 -140 240 -120 340 -30 L 340 50 C 240 -40 120 -60 0 20 Z" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
    <path d="M 0 -70 C -120 -140 -240 -120 -340 -30 L -340 50 C -240 -40 -120 -60 0 20 Z" fill="rgba(242,140,40,0.2)" stroke="rgba(255,159,67,0.4)" stroke-width="2"/>
    <path d="M 0 -140 C 100 -200 200 -180 290 -100 L 290 -30 C 200 -110 100 -130 0 -50 Z" fill="url(#primaryGrad)" opacity="0.85" filter="url(#softGlow)"/>
    <path d="M 0 -140 C -100 -200 -200 -180 -290 -100 L -290 -30 C -200 -110 -100 -130 0 -50 Z" fill="rgba(255,255,255,0.18)" stroke="#FFF7ED" stroke-width="2"/>
  </g>
  <!-- Rising beacon of learning -->
  <circle cx="600" cy="200" r="44" fill="url(#primaryGrad)" filter="url(#softGlow)"/>
  <circle cx="600" cy="200" r="18" fill="#FFF7ED"/>
  <!-- Rays of guidance -->
  <g stroke="rgba(255,159,67,0.3)" stroke-width="2" stroke-linecap="round">
    <line x1="600" y1="120" x2="600" y2="70"/>
    <line x1="660" y1="140" x2="700" y2="100"/>
    <line x1="680" y1="200" x2="730" y2="200"/>
    <line x1="540" y1="140" x2="500" y2="100"/>
    <line x1="520" y1="200" x2="470" y2="200"/>
  </g>
</svg>`,

  'education-careers-2.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Career path compass with progressive trajectory milestones">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="580" cy="400" r="360" fill="url(#radialAmber)"/>
  <!-- Multi-trajectory navigation paths -->
  <path d="M 150 650 Q 400 620 520 460 T 950 200" fill="none" stroke="url(#primaryGrad)" stroke-width="6" stroke-linecap="round" filter="url(#softGlow)"/>
  <path d="M 250 700 Q 480 550 620 440 T 1050 320" fill="none" stroke="rgba(255,159,67,0.4)" stroke-width="3" stroke-dasharray="10 8"/>
  <path d="M 200 500 Q 420 380 600 320 T 900 120" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <!-- Milestone glass nodes -->
  <g>
    <!-- Point 1 -->
    <circle cx="320" cy="600" r="18" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
    <circle cx="320" cy="600" r="8" fill="#F28C28"/>
    <!-- Point 2 -->
    <circle cx="520" cy="460" r="28" fill="rgba(242,140,40,0.2)" stroke="rgba(255,159,67,0.6)" stroke-width="2.5" filter="url(#softGlow)"/>
    <circle cx="520" cy="460" r="12" fill="#FFF7ED"/>
    <!-- Point 3 -->
    <circle cx="740" cy="310" r="22" fill="rgba(255,255,255,0.15)" stroke="#FFF7ED" stroke-width="2"/>
    <circle cx="740" cy="310" r="10" fill="#FF9F43"/>
    <!-- Goal Point -->
    <circle cx="950" cy="200" r="36" fill="url(#primaryGrad)" filter="url(#softGlow)"/>
    <circle cx="950" cy="200" r="14" fill="#FFF7ED"/>
    <polygon points="950,150 962,188 1002,188 970,212 982,250 950,226 918,250 930,212 898,188 938,188" fill="#FFF7ED" opacity="0.3"/>
  </g>
</svg>`,

  'education-careers-3.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Skill mastery hierarchy and interlocking educational modules">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="620" cy="380" r="380" fill="url(#radialAmber)"/>
  <!-- Interlocking isometric honeycomb hexagon blocks -->
  <g transform="translate(600, 420)">
    <!-- Base tier -->
    <polygon points="-160,180 -60,120 -60,0 -160,-60 -260,0 -260,120" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
    <polygon points="40,180 140,120 140,0 40,-60 -60,0 -60,120" fill="rgba(242,140,40,0.1)" stroke="rgba(242,140,40,0.3)" stroke-width="2"/>
    <polygon points="240,180 340,120 340,0 240,-60 140,0 140,120" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <!-- Middle tier -->
    <polygon points="-60,10 40,-50 40,-170 -60,-230 -160,-170 -160,-50" fill="rgba(242,140,40,0.2)" stroke="rgba(255,159,67,0.5)" stroke-width="2"/>
    <polygon points="140,10 240,-50 240,-170 140,-230 40,-170 40,-50" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.25)" stroke-width="2"/>
    <!-- Apex mastery block -->
    <polygon points="40,-160 140,-220 140,-340 40,-400 -60,-340 -60,-220" fill="url(#primaryGrad)" stroke="#FFF7ED" stroke-width="3" filter="url(#softGlow)"/>
    <circle cx="40" cy="-280" r="22" fill="#FFF7ED"/>
    <circle cx="-60" cy="-110" r="14" fill="#FF9F43"/>
    <circle cx="140" cy="-110" r="14" fill="#F28C28"/>
  </g>
</svg>`,

  // 4. Digital Lifestyle (3 images)
  'digital-lifestyle-1.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Harmonious digital flow and organic lifestyle ripples">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="600" cy="400" r="390" fill="url(#radialAmber)"/>
  <!-- Concentric fluid waves of balance -->
  <g fill="none" stroke-linecap="round">
    <ellipse cx="600" cy="400" rx="460" ry="240" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    <ellipse cx="600" cy="400" rx="360" ry="190" stroke="rgba(242,140,40,0.2)" stroke-width="2.5"/>
    <ellipse cx="600" cy="400" rx="260" ry="140" stroke="url(#primaryGrad)" stroke-width="4" filter="url(#softGlow)"/>
    <ellipse cx="600" cy="400" rx="160" ry="86" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  </g>
  <!-- Floating translucent wellness pebbles -->
  <ellipse cx="600" cy="400" rx="70" ry="40" fill="url(#primaryGrad)" filter="url(#softGlow)"/>
  <ellipse cx="600" cy="390" rx="30" ry="16" fill="#FFF7ED"/>
  <!-- Ambient floating orbs -->
  <circle cx="340" cy="300" r="24" fill="rgba(255,255,255,0.12)" stroke="rgba(255,159,67,0.4)" stroke-width="2"/>
  <circle cx="860" cy="480" r="28" fill="rgba(242,140,40,0.25)" stroke="#FF9F43" stroke-width="2" filter="url(#softGlow)"/>
  <circle cx="420" cy="520" r="16" fill="#FF9F43"/>
  <circle cx="780" cy="260" r="18" fill="#F28C28"/>
</svg>`,

  'digital-lifestyle-2.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Modern flexible digital workspace and intentional focus view">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="700" cy="340" r="380" fill="url(#radialAmber)"/>
  <!-- Perspective portal window frames -->
  <polygon points="200,680 500,560 500,240 200,120" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <polygon points="500,560 900,560 900,240 500,240" fill="rgba(242,140,40,0.12)" stroke="rgba(255,159,67,0.4)" stroke-width="2.5"/>
  <polygon points="900,560 1060,640 1060,180 900,240" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
  <!-- Central sun of productivity -->
  <circle cx="700" cy="360" r="80" fill="url(#primaryGrad)" filter="url(#softGlow)"/>
  <circle cx="700" cy="360" r="30" fill="#FFF7ED"/>
  <!-- Horizon line -->
  <line x1="500" y1="420" x2="900" y2="420" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  <!-- Floating workspace focus cards -->
  <rect x="300" y="320" width="120" height="80" rx="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,159,67,0.5)" stroke-width="1.5"/>
  <rect x="760" y="460" width="180" height="100" rx="12" fill="rgba(23,23,23,0.7)" stroke="#FF9F43" stroke-width="2"/>
  <line x1="790" y1="490" x2="890" y2="490" stroke="#FFF7ED" stroke-width="3" stroke-linecap="round"/>
  <line x1="790" y1="515" x2="860" y2="515" stroke="#F28C28" stroke-width="2.5" stroke-linecap="round"/>
</svg>`,

  'digital-lifestyle-3.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" width="1200" height="800" role="img" aria-label="Digital wellbeing rhythm and calm oscillating waves">
  ${sharedDefs}
  <rect width="1200" height="800" fill="url(#darkBg)"/>
  <circle cx="600" cy="400" r="380" fill="url(#radialAmber)"/>
  <!-- Flowing harmonic sine curves -->
  <path d="M 100 400 C 300 240 450 560 650 360 C 800 220 950 480 1100 380" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
  <path d="M 100 430 C 280 290 470 520 670 330 C 830 180 970 450 1100 410" fill="none" stroke="url(#primaryGrad)" stroke-width="5" stroke-linecap="round" filter="url(#softGlow)"/>
  <path d="M 100 460 C 260 340 490 480 690 300 C 860 140 990 420 1100 440" fill="none" stroke="rgba(255,159,67,0.4)" stroke-width="3" stroke-dasharray="8 6"/>
  <!-- Spherical harmonic checkpoints -->
  <circle cx="380" cy="430" r="20" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
  <circle cx="670" cy="330" r="26" fill="url(#primaryGrad)" filter="url(#softGlow)"/>
  <circle cx="670" cy="330" r="10" fill="#FFF7ED"/>
  <circle cx="890" cy="270" r="16" fill="#FF9F43"/>
</svg>`
};

console.log('Generating Category Visual Library (12 images)...');
let count = 0;
for (const [filename, svg] of Object.entries(images)) {
  const filepath = path.join(CATEGORY_DIR, filename);
  fs.writeFileSync(filepath, svg.trim() + '\n', 'utf8');
  count++;
  console.log(`  ✓ Created ${filename} (${svg.length} bytes)`);
}

console.log(`\nSuccessfully created ${count} category images in assets/images/categories/`);

