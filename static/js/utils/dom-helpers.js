// ── DOM Helpers ──

export function copyPrice(btn, val) {
    if (!val || val === '—' || val === 'null' || val === 'undefined') return;
    navigator.clipboard.writeText(val.toString()).then(function() {
        btn.classList.add('copied');
        var orig = btn.textContent;
        btn.textContent = '已複製';
        setTimeout(function() { btn.classList.remove('copied'); btn.textContent = orig; }, 1500);
    }).catch(function() {});
}

export function _highlightCryptoButton(val) {
    var symbols = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','DOTUSDT','LINKUSDT','MATICUSDT','UNIUSDT','ATOMUSDT','LTCUSDT','ETCUSDT','XLMUSDT','NEARUSDT','APTUSDT','ARBUSDT','OPUSDT'];
    symbols.forEach(function(s) {
        var btn = document.getElementById('btn-' + s);
        if (!btn) return;
        if (s === val) {
            btn.style.background = 'var(--accent-blue)';
            btn.style.borderColor = 'var(--accent-blue)';
            btn.style.color = 'white';
        } else {
            btn.style.background = 'var(--bg-tertiary)';
            btn.style.borderColor = 'var(--border-color)';
            btn.style.color = 'var(--text-primary)';
        }
    });
}
