// ── Dashboard Entry Point ──
import * as formatters from './utils/formatters.js';
import * as dom from './utils/dom-helpers.js';
import * as api from './modules/api.js';
import * as marketSwitch from './modules/market_switch.js';
import * as chartMarket from './modules/chart_market.js';
import * as strategies from './modules/strategies.js';
import * as modal from './modules/modal_strategy.js';
import * as sentiment from './modules/sentiment.js';

// ── Expose API_BASE ──
window.API_BASE = '/api';

// ── Expose formatters globally (used everywhere) ──
window.fmt = formatters.fmt;
window.fmtPrice = formatters.fmtPrice;
window.fmtPct = formatters.fmtPct;
window.fmtNum = formatters.fmtNum;
window.escHtml = formatters.escHtml;

// ── Expose global state ──
window.currentTF = 'D';
window.currentSym = 'BTCUSDT';
window.currentMarket = 'CRYPTO';
window.currentCRYPTOTF = 'D';
window.currentCRYPTStock = 'BTCUSDT';
window.currentTWSEStock = '2330';
window.currentUSStock = 'AAPL';
window.currentUSTF = 'D';
window._twseSearchTimer = null;
window.lastSuccessfulUpdate = null;

// ── Expose unified market functions globally ──
window.onSymbolChange = chartMarket.onSymbolChange;
window.loadQuote = chartMarket.loadQuote;
window.loadChart = chartMarket.loadChart;
window.loadSymbols = chartMarket.loadSymbols;

// ── Expose utility helpers ──
window.copyPrice = dom.copyPrice;
window._highlightCryptoButton = dom._highlightCryptoButton;
window.updateBadge = updateBadge;
window.formatTime = formatTime;

// ── Expose market-switch (tab switching only, chart logic removed) ──
window.switchMarket = marketSwitch.switchMarket;

// ── Expose strategy functions globally ──
window.loadStrategies = strategies.loadStrategies;
window.computeConsensus = strategies.computeConsensus;
window.renderStrategyOverview = strategies.renderStrategyOverview;
window.renderRankingTable = strategies.renderRankingTable;
window.rankSetSort = strategies.rankSetSort;
window.doRankSort = strategies.doRankSort;

// ── Expose modal functions globally ──
window.openStrategyModalById = modal.openStrategyModalById;
window._doRenderModal = modal._doRenderModal;
window.closeStrategyModal = modal.closeStrategyModal;
window.togglePriceLine = modal.togglePriceLine;
window.clearPriceLines = modal.clearPriceLines;

// ── Expose sentiment functions globally ──
window.setChip = sentiment.setChip;
window.renderMarketSentiment = sentiment.renderMarketSentiment;

// ── Utilities still needed at module level ──
function updateBadge(status, text) {
    var badge = document.getElementById('update-badge');
    var timeEl = document.getElementById('update-time');
    if (badge) badge.className = 'update-badge ' + (status || '');
    if (timeEl) timeEl.textContent = text || '';
}

function formatTime(date) {
    if (!date) return '--';
    return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Tab Switching ──
window.switchTab = function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(function(el) { el.style.display = 'none'; });
    document.querySelectorAll('#tab-bar button, [id^="tab-btn-"]').forEach(function(el) {
        el.style.background = '';
        el.style.color = 'var(--text-muted)';
    });
    var tabEl = document.getElementById('tab-' + tab);
    if (tabEl) tabEl.style.display = 'block';
    var btnEl = document.getElementById('tab-btn-' + tab);
    if (btnEl) { btnEl.style.background = '#333'; btnEl.style.color = '#fff'; }
};

// ── Event Bindings ──
document.addEventListener('DOMContentLoaded', function() {
    // ── Unified TF button event delegation ──
    document.querySelectorAll('.chart-tf .tf-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var market = btn.dataset.market;
            var tf = btn.dataset.tf;
            if (!market) return;
            var sym = window['current' + market + 'Stock'];
            window['current' + market + 'TF'] = tf;
            document.querySelectorAll('#tf-' + market + ' .tf-btn').forEach(function(b) {
                b.classList.toggle('active', b === btn);
            });
            window.loadChart(market, sym, tf);
        });
    });

    // ── Initial symbol list loading ──
    setTimeout(function() {
        window.loadSymbols('CRYPTO');
        window.loadSymbols('TWSE');
        window.loadSymbols('US');
    }, 100);

    // ── Initial load ──
    window.switchMarket('CRYPTO');
    window.loadStrategies();
});

// Fallback: run immediately if DOM already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(function() {
        window.switchMarket('CRYPTO');
        window.loadStrategies();
    }, 10);
}

// Stale check with auto-retry
setInterval(function() {
    if (window.lastSuccessfulUpdate) {
        var elapsed = Math.floor((Date.now() - window.lastSuccessfulUpdate.getTime()) / 1000);
        if (elapsed > 90) {
            window.updateBadge('stale', '逾期 ' + Math.floor(elapsed/60) + 'm');
            window.loadStrategies();
        }
    }
}, 30000);

// ESC key closes modal
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') window.closeStrategyModal();
});

// Document-level click listener for strategy table rows
document.addEventListener('click', function(e) {
    var tr = e.target.closest('tr[data-sid]');
    if (tr) {
        var id = tr.getAttribute('data-sid');
        if (id) window.openStrategyModalById(id);
    }
});
