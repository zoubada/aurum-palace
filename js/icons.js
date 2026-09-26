'use strict';
/* ============ Icônes ============ */
const P={
home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
slots:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M9 5v14M15 5v14"/>',
cards:'<path d="M12 3C9.5 6.5 5 9 5 12.8a3.4 3.4 0 0 0 6 2.2L10.2 21h3.6L13 15a3.4 3.4 0 0 0 6-2.2C19 9 14.5 6.5 12 3z"/>',
zap:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
ticket:'<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2z"/><path d="M14 6v2m0 3v2m0 3v2"/>',
heart:'<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
gift:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8C10 4 7 4 7 6s3 2 5 2zm0 0c2-4 5-4 5-2s-3 2-5 2z"/>',
crown:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8M9 18h6"/>',
user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
vol:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/>',
mute:'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="m17 9 5 6m0-6-5 6"/>',
plus:'<path d="M12 5v14M5 12h14"/>',
back:'<path d="M15 18l-6-6 6-6"/>',
grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
scale:'<path d="M12 3v18M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0zM8 21h8"/>',
star:'<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.3L12 17.5 6.5 20.4l1-6.3L3 9.7l6.2-.9z"/>',
eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
eyeoff:'<path d="M3 3l18 18"/><path d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6 0 10 7 10 7a17.7 17.7 0 0 1-3.2 4M6.2 6.7C3.4 8.5 2 12 2 12s4 7 10 7a9.7 9.7 0 0 0 3.4-.6"/><path d="M9.9 10a3 3 0 0 0 4.2 4.2"/>',
hand:'<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V3.5a1.5 1.5 0 0 1 3 0V11M14 11.2V5.5a1.5 1.5 0 0 1 3 0V13"/><path d="M8 12l-1.8-1.8a1.6 1.6 0 0 0-2.3 2.3L8 17a6 6 0 0 0 6 1.4c2.6-.8 3-2 3-5.4v-2"/>',
double:'<rect x="3" y="7" width="12" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>',
split:'<path d="M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8.5 7.5 19 18M8.5 16.5 19 6"/>',
arrow:'<path d="M4 12h16M14 6l6 6-6 6"/>',
gem:'<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3 6 9l6 12 6-12-3-6M9 3h6"/>',
bomb:'<circle cx="11" cy="14" r="7"/><path d="M15.5 9.5 18 7m0 0-1-2.5L19.5 5 18 7l2.5 1-2.5.7"/>',
close:'<path d="M6 6l12 12M18 6 6 18"/>'
};
const ic=(n,s=20)=>`<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]}</svg>`;
const LOGO=(s=34)=>`<svg width="${s}" height="${s}" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="lg${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F5D76E"/><stop offset=".5" stop-color="#D4AF37"/><stop offset="1" stop-color="#8B6508"/></linearGradient></defs><polygon points="20,2 35.6,11 35.6,29 20,38 4.4,29 4.4,11" fill="url(#lg${s})"/><polygon points="20,7 31.3,13.5 31.3,26.5 20,33 8.7,26.5 8.7,13.5" fill="#0B0D12"/><path d="M20 11.5 27 28h-3.6l-1.4-3.6h-4l-1.4 3.6H13zM20 17l-1.6 4.5h3.2z" fill="url(#lg${s})"/></svg>`;
