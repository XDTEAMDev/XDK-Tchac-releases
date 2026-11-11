/* Dans l'appli Android, la WebView ne sait pas parler : selon les versions, speechSynthesis manque, ou il existe mais
   ne dit rien. Ce petit pont le remplace toujours dans l'appli et passe le texte à la voix d'Android (TextToSpeech),
   via l'objet AndroidTTS ajouté par MainActivity. Sur PC et dans un navigateur (pas d'AndroidTTS), il ne fait rien. */
(function () {
  if (!window.AndroidTTS) return;

  var queue = {};
  var n = 0;
  var listeners = {};
  var voice = { name: 'Voix Android', lang: 'fr-FR', localService: true, default: true, voiceURI: 'android-tts' };

  function Utterance(text) {
    this.text = text || '';
    this.lang = 'fr-FR';
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
  }

  function fire(type) {
    var ev = { type: type };
    (listeners[type] || []).forEach(function (f) { try { f(ev); } catch (e) {} });
    if (type === 'voiceschanged' && typeof synth.onvoiceschanged === 'function') {
      try { synth.onvoiceschanged(ev); } catch (e) {}
    }
  }

  var synth = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    getVoices: function () { return window.AndroidTTS.isReady() ? [voice] : []; },
    speak: function (u) {
      var id = 'u' + (++n);
      queue[id] = u;
      synth.speaking = true;
      window.AndroidTTS.speak(id, String(u.text || ''), +u.rate || 1, +u.pitch || 1);
    },
    cancel: function () {
      var ids = Object.keys(queue);
      queue = {};
      synth.speaking = false;
      window.AndroidTTS.stop();
      ids.forEach(function () {});
    },
    pause: function () {},
    resume: function () {},
    addEventListener: function (type, f) { (listeners[type] = listeners[type] || []).push(f); },
    removeEventListener: function (type, f) {
      listeners[type] = (listeners[type] || []).filter(function (g) { return g !== f; });
    }
  };

  // Appelé par MainActivity : début, fin ou erreur d'une phrase, et « ready » quand la voix est prête.
  window.__ttsEvent = function (id, type) {
    if (type === 'ready') { fire('voiceschanged'); return; }
    var u = queue[id];
    if (!u) return;
    if (type === 'start') { if (typeof u.onstart === 'function') u.onstart({ type: 'start' }); return; }
    delete queue[id];
    if (!Object.keys(queue).length) synth.speaking = false;
    var cb = type === 'end' ? u.onend : u.onerror;
    if (typeof cb === 'function') cb({ type: type, error: type === 'error' ? 'interrupted' : undefined });
  };

  // defineProperty : une simple affectation ne remplace pas le speechSynthesis déjà fourni par la WebView.
  function remplacer(nom, valeur) {
    try { Object.defineProperty(window, nom, { value: valeur, configurable: true, writable: true }); }
    catch (e) { window[nom] = valeur; }
  }
  remplacer('SpeechSynthesisUtterance', Utterance);
  remplacer('speechSynthesis', synth);
})();
