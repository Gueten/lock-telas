'use strict';
// A captura de tela precisa rodar numa aba: o popup fecha sozinho quando o seletor de tela abre.
const api = globalThis.browser ?? globalThis.chrome;
const field = document.getElementById('code');

const go = (hash = '') => {
  api.tabs.create({ url: api.runtime.getURL('app.html') + hash });
  window.close();
};

const watch = () => {
  const code = field.value.split('#').pop().replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (code) go('#' + code);
  else field.focus();
};

document.getElementById('share').onclick = () => go();
document.getElementById('go').onclick = watch;
field.onkeydown = e => { if (e.key === 'Enter') watch(); };
