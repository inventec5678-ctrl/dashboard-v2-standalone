// ── Formatting Utilities ──

export function fmt(n, decimals) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    decimals = decimals !== undefined ? decimals : 2;
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPrice(n) {
    if (!n) return '—';
    return '$' + fmt(n);
}

export function fmtPct(n) {
    if (!n && n !== 0) return '—';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
}

export function fmtNum(n) {
    if (!n) return '—';
    if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(2) + 'K';
    return n.toFixed(2);
}

export function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
