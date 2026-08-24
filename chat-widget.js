// Онлайн-чат BYN RECORDS: плавающая кнопка + окно диалога.
// Отвечает тот же бот, что в Instagram Direct (ig-agent на студийном mac mini):
// виджет шлёт POST {session, text} на ENDPOINT, в ответ приходит
// {action:"reply", messages:[...]} или {action:"escalate"} — тогда предлагаем
// клиенту продолжить в Telegram/Instagram, дальше диалог ведёт живой менеджер.
//
// Пока ENDPOINT не заполнен реальным адресом, виджет не показывается вовсе —
// сайт можно деплоить, ничего не сломается.
(function () {
  var ENDPOINT = 'https://mac-mini-1.tailbf81bd.ts.net/chat';
  try {
    // Для локальной проверки: localStorage.setItem('byn_chat_endpoint', 'http://localhost:3000/chat')
    ENDPOINT = localStorage.getItem('byn_chat_endpoint') || ENDPOINT;
  } catch (e) {}
  if (ENDPOINT.indexOf('ЗАМЕНИ') !== -1) return;

  var TG_URL = 'https://t.me/bynrecords';
  var IG_URL = 'https://instagram.com/byn.records';

  // ── Состояние в localStorage: переживает перезагрузку страницы ──
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function newSession() {
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : 'ss-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    lsSet('byn_chat_session', id);
    return id;
  }
  var session = lsGet('byn_chat_session') || newSession();
  var log = [];
  try { log = JSON.parse(lsGet('byn_chat_log') || '[]'); } catch (e) {}

  function saveLog() { lsSet('byn_chat_log', JSON.stringify(log.slice(-100))); }
  function track(name, params) {
    if (typeof gtag === 'function') gtag('event', name, params || {});
  }

  // ── Стили ──
  var css = [
    '#byn-chat{font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}',
    '#byn-chat *{box-sizing:border-box;margin:0;padding:0}',
    '#byn-chat-fab{position:fixed;right:22px;bottom:22px;z-index:9990;width:58px;height:58px;border:0;border-radius:50%;background:#FF3D00;color:#EBEBEB;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(255,61,0,.35);transition:transform .2s,background .2s}',
    '#byn-chat-fab:hover{background:#ff5a20;transform:translateY(-2px)}',
    '#byn-chat-fab svg{width:26px;height:26px;display:block}',
    '#byn-chat-panel{position:fixed;right:22px;bottom:94px;z-index:9991;width:360px;max-width:calc(100vw - 24px);height:540px;max-height:calc(100vh - 120px);display:flex;flex-direction:column;background:#0B0B0B;border:1px solid rgba(255,255,255,.12);border-radius:16px;box-shadow:0 24px 64px rgba(0,0,0,.6);overflow:hidden;opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .25s,transform .25s}',
    '#byn-chat-panel.open{opacity:1;transform:none;pointer-events:auto}',
    '#byn-chat .bc-head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:#060606;border-bottom:1px solid rgba(255,255,255,.08);flex:0 0 auto}',
    '#byn-chat .bc-title{font-size:13px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#EBEBEB}',
    '#byn-chat .bc-sub{display:flex;align-items:center;gap:6px;margin-top:4px;font-size:11px;font-weight:400;letter-spacing:.08em;color:rgba(235,235,235,.55);text-transform:none}',
    '#byn-chat .bc-dot{width:6px;height:6px;border-radius:50%;background:#2ECC71;box-shadow:0 0 6px rgba(46,204,113,.8)}',
    '#byn-chat .bc-actions{display:flex;align-items:center;gap:4px}',
    '#byn-chat .bc-reset,#byn-chat .bc-close{border:0;background:none;color:rgba(235,235,235,.5);cursor:pointer;transition:color .2s}',
    '#byn-chat .bc-reset{font-size:11px;letter-spacing:.06em;padding:6px}',
    '#byn-chat .bc-close{font-size:22px;line-height:1;padding:2px 6px}',
    '#byn-chat .bc-reset:hover,#byn-chat .bc-close:hover{color:#FF3D00}',
    '#byn-chat .bc-msgs{flex:1 1 auto;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.2) transparent}',
    '#byn-chat .bc-m{max-width:82%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.45;color:#EBEBEB;word-wrap:break-word;white-space:pre-wrap}',
    '#byn-chat .bc-m.b{align-self:flex-start;background:#181818;border-bottom-left-radius:4px}',
    '#byn-chat .bc-m.u{align-self:flex-end;background:#FF3D00;border-bottom-right-radius:4px}',
    '#byn-chat .bc-m.s{align-self:center;background:none;color:rgba(235,235,235,.55);font-size:12px;text-align:center;max-width:95%}',
    '#byn-chat .bc-links{align-self:flex-start;display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}',
    '#byn-chat .bc-links a{display:inline-block;padding:8px 16px;border:1px solid rgba(255,255,255,.25);border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#EBEBEB;text-decoration:none;transition:border-color .2s,color .2s}',
    '#byn-chat .bc-links a:hover{border-color:#FF3D00;color:#FF3D00}',
    '#byn-chat .bc-typing{align-self:flex-start;display:flex;gap:4px;padding:12px 14px;background:#181818;border-radius:14px;border-bottom-left-radius:4px}',
    '#byn-chat .bc-typing i{width:6px;height:6px;border-radius:50%;background:rgba(235,235,235,.5);animation:bcBlink 1.2s infinite}',
    '#byn-chat .bc-typing i:nth-child(2){animation-delay:.2s}',
    '#byn-chat .bc-typing i:nth-child(3){animation-delay:.4s}',
    '@keyframes bcBlink{0%,80%,100%{opacity:.25}40%{opacity:1}}',
    '#byn-chat .bc-form{display:flex;gap:8px;padding:12px 14px;border-top:1px solid rgba(255,255,255,.08);background:#060606;flex:0 0 auto}',
    '#byn-chat .bc-form input{flex:1;border:1px solid rgba(255,255,255,.15);border-radius:999px;background:#0F0F0F;color:#EBEBEB;font-size:14px;font-family:inherit;padding:10px 16px;outline:none;transition:border-color .2s}',
    '#byn-chat .bc-form input:focus{border-color:rgba(255,61,0,.6)}',
    '#byn-chat .bc-form input::placeholder{color:rgba(235,235,235,.35)}',
    '#byn-chat .bc-send{flex:0 0 auto;width:42px;height:42px;border:0;border-radius:50%;background:#FF3D00;color:#EBEBEB;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s,opacity .2s}',
    '#byn-chat .bc-send:hover{background:#ff5a20}',
    '#byn-chat .bc-send[disabled]{opacity:.45;cursor:default}',
    '#byn-chat .bc-send svg{width:18px;height:18px;display:block;margin-left:2px}',
    '#byn-chat .bc-note{padding:0 14px 10px;background:#060606;font-size:10px;letter-spacing:.04em;color:rgba(235,235,235,.35);text-align:center;flex:0 0 auto}',
    '@media (max-width:640px){#byn-chat-fab{right:16px;bottom:16px}#byn-chat-panel{right:12px;left:12px;bottom:84px;width:auto;height:min(540px,calc(100dvh - 100px))}}'
  ].join('\n');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ── Разметка ──
  var ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>';
  var ICON_SEND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>';

  var root = document.createElement('div');
  root.id = 'byn-chat';
  root.innerHTML =
    '<button id="byn-chat-fab" aria-label="Открыть чат со студией">' + ICON_CHAT + '</button>' +
    '<div id="byn-chat-panel" role="dialog" aria-label="Чат BYN RECORDS">' +
      '<div class="bc-head">' +
        '<div><div class="bc-title">BYN Records</div>' +
        '<div class="bc-sub"><span class="bc-dot"></span>онлайн-помощник студии</div></div>' +
        '<div class="bc-actions">' +
          '<button class="bc-reset" type="button" title="Начать диалог заново">заново</button>' +
          '<button class="bc-close" type="button" aria-label="Закрыть чат">&times;</button>' +
        '</div>' +
      '</div>' +
      '<div class="bc-msgs"></div>' +
      '<form class="bc-form">' +
        '<input type="text" maxlength="1000" placeholder="Напишите сообщение…" autocomplete="off" aria-label="Сообщение">' +
        '<button class="bc-send" type="submit" aria-label="Отправить">' + ICON_SEND + '</button>' +
      '</form>' +
      '<div class="bc-note">Отвечает ИИ-помощник. Сложные вопросы передаёт менеджеру студии</div>' +
    '</div>';
  document.body.appendChild(root);

  var fab = root.querySelector('#byn-chat-fab');
  var panel = root.querySelector('#byn-chat-panel');
  var msgsEl = root.querySelector('.bc-msgs');
  var form = root.querySelector('.bc-form');
  var input = form.querySelector('input');
  var sendBtn = form.querySelector('.bc-send');

  // ── Сообщения ──
  function scrollDown() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  function addMsg(role, text, skipLog) {
    var el = document.createElement('div');
    el.className = 'bc-m ' + role;
    el.textContent = text;
    msgsEl.appendChild(el);
    scrollDown();
    if (!skipLog) { log.push({ r: role, t: text }); saveLog(); }
    return el;
  }

  function addHandoffLinks(skipLog) {
    var el = document.createElement('div');
    el.className = 'bc-links';
    el.innerHTML =
      '<a href="' + TG_URL + '" target="_blank" rel="noopener">Telegram</a>' +
      '<a href="' + IG_URL + '" target="_blank" rel="noopener">Instagram</a>';
    msgsEl.appendChild(el);
    scrollDown();
    if (!skipLog) { log.push({ r: 'links' }); saveLog(); }
  }

  var typingEl = null;
  function showTyping() {
    if (typingEl) return;
    typingEl = document.createElement('div');
    typingEl.className = 'bc-typing';
    typingEl.innerHTML = '<i></i><i></i><i></i>';
    msgsEl.appendChild(typingEl);
    scrollDown();
  }
  function hideTyping() {
    if (typingEl) { typingEl.remove(); typingEl = null; }
  }

  function greet() {
    addMsg('b', 'Привет! Это чат студии BYN RECORDS 👋');
    addMsg('b', 'Спроси про цены, запись или адрес — отвечу сразу.');
  }

  // Восстановить историю после перезагрузки страницы
  if (log.length) {
    log.forEach(function (m) {
      if (m.r === 'links') addHandoffLinks(true);
      else addMsg(m.r, m.t, true);
    });
  } else {
    greet();
  }

  // ── Открытие/закрытие ──
  var opened = false;
  function setOpen(open) {
    opened = open;
    panel.classList.toggle('open', open);
    fab.innerHTML = open ? ICON_CLOSE : ICON_CHAT;
    fab.setAttribute('aria-label', open ? 'Закрыть чат' : 'Открыть чат со студией');
    if (open) {
      scrollDown();
      if (window.innerWidth > 640) input.focus();
      if (!setOpen.tracked) { setOpen.tracked = true; track('chat_open'); }
    }
  }
  fab.addEventListener('click', function () { setOpen(!opened); });
  root.querySelector('.bc-close').addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && opened) setOpen(false);
  });

  root.querySelector('.bc-reset').addEventListener('click', function () {
    session = newSession();
    log = [];
    lsDel('byn_chat_log');
    lsDel('byn_chat_esc');
    msgsEl.innerHTML = '';
    hideTyping();
    greet();
  });

  // ── Отправка ──
  var pending = false;

  function escalated() { return lsGet('byn_chat_esc') === '1'; }

  function showEscalation() {
    if (escalated()) {
      // Менеджер уже в курсе — тихо подтверждаем, что дописанное ему передано
      addMsg('s', '✓ Передано менеджеру');
      return;
    }
    lsSet('byn_chat_esc', '1');
    addMsg('b', 'Передаю менеджеру — ответит живой человек 🙌');
    addMsg('s', 'Быстрее всего продолжить в мессенджере:');
    addHandoffLinks();
    track('chat_escalated');
  }

  function showError() {
    addMsg('s', 'Не получилось отправить 😕 Напишите нам напрямую:');
    addHandoffLinks();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send();
  });
  // Явный Enter: сторонние скрипты страницы не должны перехватить отправку
  input.addEventListener('keydown', function (e) {
    if (e.isComposing) return;
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      e.stopPropagation();
      send();
    }
  });

  function send() {
    var text = input.value.trim();
    if (!text || pending) return;

    input.value = '';
    addMsg('u', text);
    if (!lsGet('byn_chat_lead')) {
      lsSet('byn_chat_lead', '1');
      track('generate_lead', { method: 'site_chat' });
    }

    pending = true;
    sendBtn.disabled = true;
    showTyping();

    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 90000);

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: session, text: text }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        hideTyping();
        if (data.action === 'reply' && data.messages && data.messages.length) {
          // Сообщения по очереди, как пишет живой человек
          data.messages.forEach(function (m, i) {
            setTimeout(function () { addMsg('b', m); }, i * 500);
          });
        } else if (data.action === 'escalate') {
          showEscalation();
        } else {
          showError();
        }
      })
      .catch(function () {
        hideTyping();
        showError();
      })
      .then(function () {
        if (timer) clearTimeout(timer);
        pending = false;
        sendBtn.disabled = false;
        if (opened && window.innerWidth > 640) input.focus();
      });
  }
})();
