// ui.js - UI Rendering & Interaction Helpers

const { storableToCard, SPECIAL_CARDS } = window.DeckModule;

// ─── Card rendering ──────────────────────────────────────────────────────────

function cardColor(card) {
  if (card.type === 'number') {
    const hue = (card.value * 27 + 10) % 360;
    return `hsl(${hue}, 70%, 52%)`;
  }
  const colorMap = {
    [SPECIAL_CARDS.FREEZE]: '#4fc3f7',
    [SPECIAL_CARDS.SECOND_CHANCE]: '#81c784',
    [SPECIAL_CARDS.FLIP3]: '#ff8a65',
    [SPECIAL_CARDS.DOUBLE]: '#ffd54f',
    [SPECIAL_CARDS.PLUS2]: '#ce93d8',
    [SPECIAL_CARDS.PLUS4]: '#ce93d8',
    [SPECIAL_CARDS.PLUS6]: '#ce93d8',
    [SPECIAL_CARDS.PLUS8]: '#ce93d8',
    [SPECIAL_CARDS.PLUS10]: '#ce93d8',
  };
  return colorMap[card.value] || '#aaa';
}

function renderCard(card, mini = false) {
  const bg = cardColor(card);
  const label = card.type === 'number' ? card.value : card.label;
  const sizeClass = mini ? 'card-mini' : 'card';
  return `<div class="${sizeClass}" style="background:${bg}" title="${label}">${label}</div>`;
}

function renderCardList(cardStorables) {
  if (!cardStorables || cardStorables.length === 0) {
    return '<span class="no-cards">Chưa có lá nào</span>';
  }
  return cardStorables.map(raw => renderCard(storableToCard(raw), true)).join('');
}

// ─── Player list rendering ───────────────────────────────────────────────────

function statusIcon(status) {
  if (status === 'playing') return '🟢';
  if (status === 'stopped') return '🔵';
  if (status === 'bust') return '💥';
  return '⚫';
}

function renderPlayerRow(pid, player, currentPlayer, isMe) {
  const isCurrent = pid === currentPlayer;
  const cards = renderCardList(player.cardsInRound);
  return `
    <div class="player-row ${isCurrent ? 'active-player' : ''} ${isMe ? 'me' : ''}">
      <div class="player-row-header">
        <span class="player-status-icon">${statusIcon(player.status)}</span>
        <span class="player-name">${escapeHtml(player.name)}${isMe ? ' (Bạn)' : ''}</span>
        ${isCurrent ? '<span class="turn-badge">Đang đi</span>' : ''}
        <span class="player-score-total">${player.totalScore || 0} điểm</span>
      </div>
      <div class="player-cards">${cards}</div>
      ${player.roundScore > 0 ? `<div class="round-score-badge">+${player.roundScore} vòng này</div>` : ''}
    </div>
  `;
}

// ─── Popup helpers ───────────────────────────────────────────────────────────

function showPopup(html) {
  let overlay = document.getElementById('popup-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'popup-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `<div class="popup-box">${html}</div>`;
  overlay.style.display = 'flex';
}

function hidePopup() {
  const overlay = document.getElementById('popup-overlay');
  if (overlay) overlay.style.display = 'none';
}

function showToast(msg, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 500); }, duration);
}

function showFlip7Banner(winnerName) {
  const banner = document.createElement('div');
  banner.className = 'flip7-banner';
  banner.innerHTML = `
    <div class="flip7-content">
      <div class="flip7-icon">🃏</div>
      <div class="flip7-title">FLIP 7!</div>
      <div class="flip7-sub">${escapeHtml(winnerName)} đã lật 7 lá khác nhau!</div>
      <div class="flip7-bonus">+${15} điểm thưởng</div>
    </div>
  `;
  document.body.appendChild(banner);
  setTimeout(() => { banner.classList.add('fade-out'); setTimeout(() => banner.remove(), 600); }, 4000);
}

function showCardDrawn(card, result) {
  const area = document.getElementById('drawn-card-area');
  if (!area) return;
  area.innerHTML = renderCard(card);
  area.classList.add('card-pop');
  setTimeout(() => area.classList.remove('card-pop'), 400);

  if (result.bust) {
    showToast('💥 BUST! Bạn mất điểm vòng này!', 'danger', 3500);
  } else if (result.secondChanceUsed) {
    showToast('🍀 Second Chance đã cứu bạn!', 'success', 3000);
  } else if (result.flip7) {
    showToast('🎉 FLIP 7! Kết thúc vòng!', 'success', 3500);
  }
}

// ─── Freeze target selector ───────────────────────────────────────────────────

function showFreezeSelector(players, currentPlayerId, onSelect) {
  const options = Object.entries(players)
    .filter(([pid, p]) => p.status === 'playing')
    .map(([pid, p]) => `
      <button class="freeze-btn" data-pid="${pid}">
        ❄️ ${escapeHtml(p.name)}
        <span class="score-tag">${p.roundScore || 0} điểm vòng</span>
      </button>
    `).join('');

  showPopup(`
    <h3>❄️ FREEZE - Chọn người bị đóng băng</h3>
    <p>Người được chọn sẽ dừng lại và lưu điểm hiện tại.</p>
    <div class="freeze-list">${options}</div>
  `);

  document.querySelectorAll('.freeze-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      hidePopup();
      onSelect(btn.dataset.pid);
    });
  });
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? '...' : btn.dataset.originalText;
}

window.UIModule = {
  renderCard,
  renderCardList,
  renderPlayerRow,
  showPopup,
  hidePopup,
  showToast,
  showFlip7Banner,
  showCardDrawn,
  showFreezeSelector,
  statusIcon,
  escapeHtml,
  setLoading,
};
