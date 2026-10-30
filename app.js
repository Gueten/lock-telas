'use strict';

const $ = id => document.getElementById(id);
const PREFIX = 'telalivre-';
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O, 1/I/L, pra não confundir ao digitar
const isExt = /-extension:$/.test(location.protocol);
const canCapture = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
const selfUrl = location.href.split(/[#?]/)[0];

const store = {
  get: k => { try { return (localStorage.getItem(k) || '').trim(); } catch { return ''; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
};

const show = name => ['home', 'sharing', 'watching'].forEach(v => { $(v).hidden = v !== name; });
const say = (id, msg) => { $(id).textContent = msg || ''; };
const clean = s => s.split('#').pop().replace(/[^a-z0-9]/gi, '').toUpperCase();
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ABC[b % ABC.length]).join('');

async function copy(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
  const old = btn.textContent;
  btn.textContent = 'Copiado!';
  setTimeout(() => { btn.textContent = old; }, 1200);
}

/* ---------- quem compartilha ---------- */

let peer = null, stream = null, shareCode = '', opened = false;
const calls = new Map();
const refreshCount = () => { $('count').textContent = calls.size; };

async function startShare() {
  say('homeMsg', '');
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 } },
      audio: $('withAudio').checked,
      selfBrowserSurface: 'exclude'
    });
  } catch (e) {
    return say('homeMsg', e.name === 'NotAllowedError'
      ? 'Seleção cancelada. Clique de novo quando quiser.'
      : 'Não consegui capturar a tela: ' + e.message);
  }
  // o botão "Parar compartilhamento" do próprio navegador dispara "ended"
  stream.getVideoTracks()[0].addEventListener('ended', () => stopShare('Compartilhamento encerrado.'));
  $('preview').srcObject = stream;
  say('homeMsg', 'Conectando ao servidor…');
  openPeer();
}

function openPeer(tries = 0) {
  opened = false;
  const code = newCode();
  const p = peer = new Peer(PREFIX + code);

  p.on('open', () => {
    opened = true;
    shareCode = code;
    renderShare();
    show('sharing');
    say('homeMsg', '');
  });
  // o espectador abre uma conexão de dados; quando ela abre, a gente liga de volta com a tela
  p.on('connection', conn => conn.on('open', () => serve(conn)));
  // caiu a conexão com o servidor de sinalização: tenta voltar (quem já assiste não é afetado)
  p.on('disconnected', () => setTimeout(() => { if (peer === p && !p.destroyed) p.reconnect(); }, 1500));
  p.on('error', err => {
    if (err.type === 'unavailable-id' && tries < 5) return openPeer(tries + 1); // código repetido, sorteia outro
    if (err.type !== 'peer-unavailable' && !opened) {
      stopShare('Não consegui falar com o servidor (' + err.type + '). Confira a internet e tente de novo.');
    }
  });
}

function serve(conn) {
  if (!peer || !stream) return;
  const call = peer.call(conn.peer, stream);
  calls.set(conn.peer, call);
  refreshCount();
  const drop = () => { call.close(); calls.delete(conn.peer); refreshCount(); };
  conn.on('close', drop);
  conn.on('error', drop);
  setTimeout(() => boost(call), 1500);
}

// sobe o limite de bitrate do vídeo pra o texto da tela ficar legível (tenta, se não der tudo bem)
function boost(call) {
  const pc = call.peerConnection;
  if (!pc) return;
  pc.getSenders().forEach(s => {
    if (!s.track || s.track.kind !== 'video') return;
    try {
      const p = s.getParameters();
      if (!p.encodings || !p.encodings.length) return;
      p.encodings[0].maxBitrate = 6e6;
      s.setParameters(p).catch(() => {});
    } catch {}
  });
}

function renderShare() {
  // dentro da extensão o endereço próprio (chrome-extension://...) não abre pra ninguém:
  // o link só existe se a pessoa colou o endereço do site hospedado
  const saved = isExt ? store.get('base') : '';
  const base = isExt ? saved : selfUrl;
  const link = base ? base.split('#')[0] + '#' + shareCode : '';

  say('codeOut', shareCode);
  $('linkBox').hidden = $('qr').hidden = !link;
  $('shareNative').hidden = !(link && navigator.share);
  $('hostBox').hidden = !isExt;
  $('hostBox').open = isExt && !saved;
  $('baseIn').value = saved;
  if (!link) return;

  $('linkOut').value = link;
  const qr = qrcode(0, 'M');
  qr.addData(link);
  qr.make();
  $('qr').src = qr.createDataURL(6);
}

function stopShare(msg) {
  const p = peer;
  peer = null;
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  calls.forEach(c => c.close());
  calls.clear();
  if (p) p.destroy();
  $('preview').srcObject = null;
  refreshCount();
  show('home');
  say('homeMsg', msg);
}

/* ---------- quem assiste ---------- */

let vpeer = null;
const setInfo = (msg, live) => { $('stage').classList.toggle('on', !!live); say('info', msg); };

function startWatch(code) {
  show('watching');
  setInfo('Conectando…');
  $('remote').srcObject = null;
  if (vpeer) vpeer.destroy();
  const p = vpeer = new Peer();

  p.on('open', () => {
    const conn = p.connect(PREFIX + code, { reliable: true });
    conn.on('close', () => setInfo('A transmissão terminou.'));
  });
  p.on('call', call => {
    call.answer(); // só recebe, não manda nada de volta
    call.on('stream', s => {
      const v = $('remote');
      setInfo('', true);
      if (v.srcObject !== s) v.srcObject = s;
      v.play().catch(() => {});
    });
    call.on('close', () => setInfo('A transmissão terminou.'));
  });
  p.on('error', err => setInfo(err.type === 'peer-unavailable'
    ? 'Código não encontrado. A pessoa já começou a compartilhar?'
    : 'Erro de conexão (' + err.type + ').'));

  if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => {}); // celular não apaga a tela
}

function route() {
  const code = clean(location.hash);
  if (code) startWatch(code);
  else show('home');
}

/* ---------- ligações ---------- */

$('startShare').disabled = !canCapture;
$('noShare').hidden = canCapture;
$('startShare').onclick = startShare;
$('stopBtn').onclick = () => stopShare('');
$('copyCode').onclick = e => copy(shareCode, e.currentTarget);
$('copyLink').onclick = e => copy($('linkOut').value, e.currentTarget);
$('shareNative').onclick = () => navigator.share({ title: 'Assista minha tela ao vivo', url: $('linkOut').value }).catch(() => {});
$('saveBase').onclick = () => { store.set('base', $('baseIn').value.trim()); renderShare(); };

$('watchBtn').onclick = () => {
  const code = clean($('codeIn').value);
  if (!code) return $('codeIn').focus();
  history.replaceState(null, '', '#' + code);
  route();
};
$('codeIn').onkeydown = e => { if (e.key === 'Enter') $('watchBtn').click(); };

$('muteBtn').onclick = () => {
  const v = $('remote');
  v.muted = !v.muted;
  $('muteBtn').textContent = v.muted ? 'Ativar som' : 'Silenciar';
};
$('fsBtn').onclick = () => {
  const stage = $('stage');
  const full = stage.requestFullscreen || stage.webkitRequestFullscreen;
  if (full) full.call(stage);
  else if ($('remote').webkitEnterFullscreen) $('remote').webkitEnterFullscreen(); // iPhone
};
$('leaveBtn').onclick = () => {
  const p = vpeer;
  vpeer = null;
  if (p) p.destroy();
  $('remote').srcObject = null;
  history.replaceState(null, '', location.pathname + location.search);
  show('home');
};

addEventListener('pagehide', () => { if (peer) peer.destroy(); if (vpeer) vpeer.destroy(); });
addEventListener('hashchange', route);
route();
