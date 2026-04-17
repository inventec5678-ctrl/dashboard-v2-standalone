// ── Dashboard Entry Point ──
import * as formatters from './utils/formatters.js';
import * as dom from './utils/dom-helpers.js';
import * as api from './modules/api.js';
import * as marketSwitch from './modules/market_switch.js';
import * as chartCrypto from './modules/chart_crypto.js';
import * as chartTWSE from './modules/chart_twse.js';
import * as chartUS from './modules/chart_us.js';
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
window.currentTF = '4h';
window.currentSym = 'BTC';
window.currentMarket = 'CRYPTO';
window.currentTWSEStock = '2330';
window.currentUSStock = 'AAPL';
window.currentUSTF = 'D';
window._twseSearchTimer = null;
window.lastSuccessfulUpdate = null;

// ── Expose utility helpers ──
window.copyPrice = dom.copyPrice;
window._highlightCryptoButton = dom._highlightCryptoButton;
window.updateBadge = updateBadge;
window.formatTime = formatTime;

// ── Expose module functions globally (for inline onclick handlers) ──
window.switchMarket = marketSwitch.switchMarket;
window.initChart = chartCrypto.initChart;
window.loadChartData = chartCrypto.loadChartData;
window.loadTWSEQuote = chartTWSE.loadTWSEQuote;
window.loadTWSEChart = chartTWSE.loadTWSEChart;
window.onTWSESearchKeyup = chartTWSE.onTWSESearchKeyup;
window.selectTWSEResult = chartTWSE.selectTWSEResult;
window.onTWSEStockChange = chartTWSE.onTWSEStockChange;
window.onCryptoSymbolChange = chartTWSE.onCryptoSymbolChange;
window.loadUSQuote = chartUS.loadUSQuote;
window.loadUSChart = chartUS.loadUSChart;
window.onUSStockChange = chartUS.onUSStockChange;
window.populateUSSymbolSelect = chartUS.populateUSSymbolSelect;
window.loadStrategies = strategies.loadStrategies;
window.computeConsensus = strategies.computeConsensus;
window.renderStrategyOverview = strategies.renderStrategyOverview;
window.renderRankingTable = strategies.renderRankingTable;
window.rankSetSort = strategies.rankSetSort;
window.doRankSort = strategies.doRankSort;

window.openStrategyModalById = modal.openStrategyModalById;
window._doRenderModal = modal._doRenderModal;
window.closeStrategyModal = modal.closeStrategyModal;
window.togglePriceLine = modal.togglePriceLine;
window.clearPriceLines = modal.clearPriceLines;
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
    // Crypto TF buttons
    document.querySelectorAll('#crypto-tf-buttons .tf-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#crypto-tf-buttons .tf-btn').forEach(function(b){ b.classList.remove('active'); });
            btn.classList.add('active');
            window.currentTF = btn.dataset.tf;
            window.loadChartData(window.currentSym, window.currentTF);
        });
    });

    // TWSE TF buttons
    document.querySelectorAll('#twse-tf-buttons .tf-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#twse-tf-buttons .tf-btn').forEach(function(b){ b.classList.remove('active'); });
            btn.classList.add('active');
            var twseTf = btn.dataset.tf;
            window.loadTWSEChart(window.currentTWSEStock, twseTf);
        });
    });

    // US TF buttons
    document.querySelectorAll('#us-tf-buttons .tf-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('#us-tf-buttons .tf-btn').forEach(function(b){ b.classList.remove('active'); });
            btn.classList.add('active');
            var usTf = btn.dataset.tf;
            window.currentUSTF = usTf;
            window.loadUSChart(window.currentUSStock, usTf);
        });
    });

    // Initial load
    window.switchMarket('CRYPTO');
    window.loadStrategies();
    window.populateUSSymbolSelect();
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
