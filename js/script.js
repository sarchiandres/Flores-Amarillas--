/* ==========================================================================
   Flores amarillas · 21 de septiembre
   JavaScript vanilla, sin librerías ni backend.

   ÍNDICE
   1. Configuración (lo que puedes cambiar fácilmente)
   2. Diseño del ramo (posición de cada flor)
   3. Utilidades
   4. Construcción de flores
   5. Elementos ambientales y celebración
   6. Secuencia de la experiencia
   7. Reinicio
   8. Modal
   9. Inicio
   ========================================================================== */


/* ==========================================================================
   1. CONFIGURACIÓN
   ========================================================================== */

/** Cantidad de flores del ramo. (El diseño manual está pensado para 10;
 *  con menos flores se usan las primeras, con más se generan flores extra.) */
const TOTAL_FLOWERS = 10;

/** Tiempos en milisegundos. Sube los números para ir más lento, bájalos para ir más rápido. */
const TIMING = {
  introDelay: 300,       // pausa antes de que aparezca la primera frase
  introFadeIn: 900,      // duración del fade-in de la frase
  introHold: 1200,       // cuánto tiempo se queda la frase visible
  introFadeOut: 700,     // duración del fade-out de la frase
  afterIntro: 300,       // pausa antes de empezar el ramo

  flowerInterval: 620,   // ⟵ VELOCIDAD DE APARICIÓN: tiempo entre una flor y la siguiente
  stemGrow: 900,         // cuánto tarda en crecer cada tallo
  headDelay: 560,        // cuándo empieza a abrirse la flor (contado desde que empieza su tallo)
  headGrow: 950,         // cuánto tarda en abrirse la flor

  finaleGap: 250,        // pausa entre la décima flor y el primer texto
  replayShowIntro: false // ¿mostrar de nuevo la frase inicial al pulsar "Volver a ver florecer"?
};


/* ==========================================================================
   2. DISEÑO DEL RAMO
   Lienzo de 100 x 122 unidades. El lazo está en (50, 100).
   x, y  → centro de la flor      size → diámetro de la flor
   z     → profundidad (más alto = más al frente)
   enter → animación de entrada: up | left | right | grow | spin
   leaves → hojas: [posición en el tallo (0 base – 1 flor), lado (-1 izq / 1 der), largo]
   El ORDEN de la lista es el orden en que aparecen las flores.
   ========================================================================== */
const TIE = { x: 50, y: 100 };

const BOUQUET_LAYOUT = [
  { x: 36, y: 42, size: 24, z: 5,  enter: 'left',  leaves: [[0.28, -1, 15], [0.44,  1, 12]] },
  { x: 64, y: 40, size: 25, z: 6,  enter: 'right', leaves: [[0.28,  1, 15], [0.42, -1, 12]] },
  { x: 50, y: 19, size: 21, z: 1,  enter: 'up',    leaves: [[0.20, -1, 14]] },
  { x: 16, y: 41, size: 21, z: 2,  enter: 'spin',  leaves: [[0.34, -1, 13]] },
  { x: 84, y: 43, size: 21, z: 3,  enter: 'spin',  leaves: [[0.34,  1, 13]] },
  { x: 30, y: 25, size: 20, z: 2,  enter: 'grow',  leaves: [[0.24, -1, 14]] },
  { x: 70, y: 24, size: 20, z: 2,  enter: 'grow',  leaves: [[0.24,  1, 14]] },
  { x: 27, y: 64, size: 23, z: 7,  enter: 'left',  leaves: [[0.30, -1, 15]] },
  { x: 74, y: 65, size: 23, z: 8,  enter: 'right', leaves: [[0.30,  1, 15]] },
  { x: 50, y: 58, size: 29, z: 10, enter: 'grow',  leaves: [[0.20, -1, 13], [0.24, 1, 13]] }
];

/** Números en palabras, para la frase principal ("Diez flores amarillas..."). */
const NUMBER_WORDS = ['cero', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho',
  'diecinueve', 'veinte'];


/* ==========================================================================
   3. UTILIDADES
   ========================================================================== */
const $ = (selector, root = document) => root.querySelector(selector);
const SVG_NS = 'http://www.w3.org/2000/svg';

const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const SPEED = reduceMotion ? 0.55 : 1; // con movimiento reducido todo va un poco más rápido

const CANCELLED = Symbol('cancelled');
let runId = 0; // cada vez que se inicia/reinicia la experiencia sube; cancela esperas anteriores

/** Espera `ms` milisegundos; si la experiencia se reinició mientras tanto, se cancela. */
function wait(ms, id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => (id === runId ? resolve() : reject(CANCELLED)), ms * SPEED);
  });
}

/** Generador pseudoaleatorio con semilla: el ramo se ve igual cada vez que se abre. */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = (min, max) => min + Math.random() * (max - min);

function el(tag, className, styles) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (styles) Object.entries(styles).forEach(([k, v]) => node.style.setProperty(k, v));
  return node;
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Referencias a elementos */
const dom = {
  ambient: $('#ambient'),
  fxLayer: $('#fx-layer'),
  intro: $('#intro'),
  experience: $('#experience'),
  stage: $('#bouquet-stage'),
  bouquet: $('#bouquet'),
  flowers: $('#flowers'),
  sparks: $('#sparks'),
  finale: $('#finale'),
  reveals: Array.from(document.querySelectorAll('#finale .reveal')),
  replayBtn: $('#replay-btn'),
  cardBtn: $('#card-btn'),
  modal: $('#modal'),
  modalCard: $('#modal .modal-card'),
  modalX: $('#modal-x'),
  modalClose: $('#modal-close'),
  modalFlower: $('#modal-flower')
};


/* ==========================================================================
   4. CONSTRUCCIÓN DE FLORES
   ========================================================================== */
const PETALS_PER_RING = 16;

/** Semillas del centro con patrón de girasol (ángulo áureo), en un solo box-shadow. */
const SEED_SHADOW = (() => {
  const count = 74;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const colors = ['rgba(255, 206, 120, .55)', 'rgba(22, 9, 4, .6)', 'rgba(170, 118, 62, .55)'];
  const parts = [];
  for (let i = 0; i < count; i++) {
    const r = 0.44 * Math.sqrt((i + 0.5) / count);
    const a = i * golden;
    parts.push(`${(r * Math.cos(a)).toFixed(3)}em ${(r * Math.sin(a)).toFixed(3)}em 0 0 ${colors[i % 3]}`);
  }
  return parts.join(',');
})();

/** Cabeza del girasol: dos anillos de pétalos + centro con semillas. */
function createHead() {
  const head = el('div', 'head');
  const tilt = el('div', 'head-tilt');

  [['petals-back', 0], ['petals-front', 0.5]].forEach(([cls, offset]) => {
    const ring = el('div', `petals ${cls}`);
    for (let i = 0; i < PETALS_PER_RING; i++) {
      const angle = ((i + offset) * 360) / PETALS_PER_RING;
      ring.appendChild(el('i', 'petal', { '--a': `${angle.toFixed(2)}deg` }));
    }
    tilt.appendChild(ring);
  });

  const disc = el('div', 'disc');
  const seeds = el('span', 'seeds');
  seeds.style.boxShadow = SEED_SHADOW;
  disc.appendChild(seeds);
  tilt.appendChild(disc);

  head.appendChild(tilt);
  return head;
}

/** Punto y tangente de una curva de Bézier cuadrática. */
function bezier(p0, p1, p2, t) {
  const mt = 1 - t;
  const x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
  const y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
  const tx = 2 * mt * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const ty = 2 * mt * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  return { x, y, angle: (Math.atan2(tx, -ty) * 180) / Math.PI }; // 0° = hacia arriba
}

/** Devuelve el diseño de la flor número `index` (las extra se generan automáticamente). */
function getFlowerSpec(index) {
  if (index < BOUQUET_LAYOUT.length) return BOUQUET_LAYOUT[index];
  const rng = makeRng(1000 + index * 97);
  const x = 16 + rng() * 68;
  const y = 18 + rng() * 44;
  return {
    x, y,
    size: 17 + rng() * 4,
    z: 1 + Math.floor(rng() * 3),
    enter: ['up', 'left', 'right', 'grow', 'spin'][Math.floor(rng() * 5)],
    leaves: [[0.22 + rng() * 0.2, x < 50 ? -1 : 1, 13]]
  };
}

/** Crea una flor completa: tallo (SVG) + hojas + cabeza. */
function createFlower(index) {
  const spec = getFlowerSpec(index);
  const rng = makeRng(42 + index * 131);
  const flower = el('div', `flower enter-${spec.enter}`, { '--z': spec.z });

  // Curva del tallo: sube casi vertical desde el lazo y se abre hacia la flor
  const head = { x: spec.x, y: spec.y };
  const dx = head.x - TIE.x;
  const dy = head.y - TIE.y;
  const control = {
    x: TIE.x + dx * 0.12 + (rng() - 0.5) * 3,
    y: TIE.y + dy * 0.62
  };
  const d = `M${TIE.x} ${TIE.y} Q${control.x.toFixed(2)} ${control.y.toFixed(2)} ${head.x} ${head.y}`;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'stem');
  svg.setAttribute('viewBox', '0 0 100 122');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  ['stem-main', 'stem-light'].forEach((cls) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class', cls);
    path.setAttribute('d', d);
    path.setAttribute('pathLength', '1');
    svg.appendChild(path);
  });
  flower.appendChild(svg);

  // Hojas repartidas a lo largo del tallo
  spec.leaves.forEach(([t, side, length]) => {
    const p = bezier(TIE, control, head, t);
    const rotation = p.angle + side * (44 + rng() * 14);
    const leaf = el('div', 'leaf', {
      '--lx': p.x.toFixed(2),
      '--ly': p.y.toFixed(2),
      '--ll': length,
      '--lw': (length * 0.46).toFixed(2),
      '--lr': `${rotation.toFixed(1)}deg`,
      '--ld': `${Math.round(TIMING.stemGrow * (t * 0.9 + 0.1))}ms`,
      '--leaf-dur': `${(4.2 + rng() * 2.4).toFixed(2)}s`
    });
    const sway = el('div', 'leaf-sway');
    sway.appendChild(el('div', 'leaf-blade'));
    leaf.appendChild(sway);
    flower.appendChild(leaf);
  });

  // Cabeza
  const headEl = createHead();
  headEl.style.setProperty('--x', spec.x);
  headEl.style.setProperty('--y', spec.y);
  headEl.style.setProperty('--size', spec.size);
  flower.appendChild(headEl);

  // Balanceo muy sutil (valores distintos por flor)
  const sign = rng() > 0.5 ? 1 : -1;
  flower.style.setProperty('--sway', `${(sign * (0.35 + rng() * 0.4)).toFixed(2)}deg`);
  flower.style.setProperty('--sway-dur', `${(5.2 + rng() * 3).toFixed(2)}s`);
  flower.style.setProperty('--nod', `${(sign * (1 + rng() * 1.4)).toFixed(2)}deg`);
  flower.style.setProperty('--nod-dur', `${(6 + rng() * 3).toFixed(2)}s`);
  flower.style.setProperty('--sway-delay', `${(rng() * 1.2).toFixed(2)}s`);

  return flower;
}

/** (Re)construye todas las flores, ocultas. */
function buildFlowers() {
  dom.flowers.textContent = '';
  for (let i = 0; i < TOTAL_FLOWERS; i++) dom.flowers.appendChild(createFlower(i));
}

/** Hace crecer una flor: tallo → hojas → flor; luego empieza a moverse suavemente. */
function growFlower(flower, id) {
  flower.classList.add('is-growing');
  setTimeout(() => {
    if (id === runId) flower.classList.add('is-idle');
  }, (TIMING.headDelay + TIMING.headGrow + 250) * SPEED);
}


/* ==========================================================================
   5. ELEMENTOS AMBIENTALES Y CELEBRACIÓN
   ========================================================================== */

/** Partículas luminosas, pétalos, hojas y estrellas discretas del fondo. */
function buildAmbient() {
  const narrow = window.innerWidth < 600;
  const count = (mobile, desktop) => (narrow ? mobile : desktop);
  const frag = document.createDocumentFragment();

  for (let i = 0; i < count(11, 20); i++) {
    frag.appendChild(el('span', 'mote', {
      left: `${rand(2, 98)}%`,
      top: `${rand(35, 100)}%`,
      '--sz': `${rand(3, 8).toFixed(1)}px`,
      '--dur': `${rand(14, 28).toFixed(1)}s`,
      '--delay': `${(-rand(0, 20)).toFixed(1)}s`,
      '--dx': `${rand(-6, 6).toFixed(1)}vw`
    }));
  }
  for (let i = 0; i < count(5, 8); i++) {
    frag.appendChild(el('span', 'drift-petal', {
      left: `${rand(0, 95)}%`,
      '--sz': `${rand(9, 14).toFixed(1)}px`,
      '--dur': `${rand(26, 42).toFixed(1)}s`,
      '--delay': `${(-rand(0, 36)).toFixed(1)}s`,
      '--dx': `${rand(-12, 14).toFixed(1)}vw`,
      '--rot': `${rand(240, 520).toFixed(0)}deg`
    }));
  }
  for (let i = 0; i < count(2, 4); i++) {
    frag.appendChild(el('span', 'drift-leaf', {
      left: `${rand(0, 95)}%`,
      '--sz': `${rand(11, 16).toFixed(1)}px`,
      '--dur': `${rand(34, 50).toFixed(1)}s`,
      '--delay': `${(-rand(0, 44)).toFixed(1)}s`,
      '--dx': `${rand(-14, 14).toFixed(1)}vw`,
      '--rot': `${rand(-380, 380).toFixed(0)}deg`
    }));
  }
  for (let i = 0; i < count(6, 10); i++) {
    frag.appendChild(el('span', 'star', {
      left: `${rand(3, 97)}%`,
      top: `${rand(3, 38)}%`,
      '--sz': `${rand(1.5, 2.8).toFixed(1)}px`,
      '--dur': `${rand(4, 9).toFixed(1)}s`,
      '--delay': `${(-rand(0, 9)).toFixed(1)}s`
    }));
  }
  dom.ambient.appendChild(frag);
}

/** Celebración al aparecer la última flor: brillo, chispas doradas y pétalos cayendo. */
function celebrate() {
  dom.bouquet.classList.add('is-celebrating');
  if (reduceMotion) return;

  // Chispas doradas que salen del ramo
  const sparks = document.createDocumentFragment();
  const sparkCount = window.innerWidth < 600 ? 22 : 32;
  for (let i = 0; i < sparkCount; i++) {
    const angle = rand(0, Math.PI * 2);
    const dist = rand(26, 64);
    sparks.appendChild(el('span', 'spark', {
      '--sp': rand(1.6, 3.6).toFixed(2),
      '--dx': `calc(var(--u) * ${(Math.cos(angle) * dist).toFixed(1)})`,
      '--dy': `calc(var(--u) * ${(Math.sin(angle) * dist * 0.9).toFixed(1)})`,
      '--sd': `${rand(1.4, 2.6).toFixed(2)}s`,
      '--sdl': `${rand(0, 0.5).toFixed(2)}s`
    }));
  }
  dom.sparks.appendChild(sparks);

  // Destellos que se quedan titilando suavemente alrededor del ramo
  [[12, 12], [88, 16], [5, 56], [95, 60], [50, 4], [26, 86], [76, 90]].forEach(([gx, gy], i) => {
    dom.sparks.appendChild(el('span', 'glint', {
      '--gx': gx, '--gy': gy,
      '--gs': (3 + (i % 3)).toFixed(1),
      '--gd': `${(3.4 + (i % 4) * 0.7).toFixed(1)}s`,
      '--gdl': `${(0.4 + i * 0.55).toFixed(2)}s`
    }));
  });

  // Pétalos que caen por toda la pantalla
  const petalCount = window.innerWidth < 600 ? 16 : 26;
  for (let i = 0; i < petalCount; i++) {
    const petal = el('span', 'fx-petal', {
      '--x0': `${rand(0, 100).toFixed(1)}vw`,
      '--sz': `${rand(10, 17).toFixed(1)}px`,
      '--dur': `${rand(6.5, 11).toFixed(1)}s`,
      '--delay': `${rand(0, 2.6).toFixed(2)}s`,
      '--dx': `${rand(-14, 14).toFixed(1)}vw`,
      '--sway': `${rand(-7, 7).toFixed(1)}vw`,
      '--rot': `${rand(300, 640).toFixed(0)}deg`
    });
    petal.addEventListener('animationend', () => petal.remove(), { once: true });
    dom.fxLayer.appendChild(petal);
  }
}


/* ==========================================================================
   6. SECUENCIA DE LA EXPERIENCIA
   ========================================================================== */
let userScrolled = false;

/** Coloca el ramo en el centro de la pantalla mientras crece; luego "sube" al aparecer el texto. */
function updateShift() {
  const stage = dom.stage;
  const naturalX = stage.offsetLeft + stage.offsetWidth / 2;
  const naturalY = stage.offsetTop + stage.offsetHeight / 2;
  const shiftX = root.clientWidth / 2 - naturalX;
  const shiftY = window.innerHeight / 2 - naturalY;
  stage.style.setProperty('--shift-x', `${Math.round(shiftX)}px`);
  stage.style.setProperty('--shift-y', `${Math.round(shiftY)}px`);
}

/** Si el usuario no ha hecho scroll, acompaña con suavidad los textos que van apareciendo. */
function keepInView(node) {
  if (userScrolled) return;
  requestAnimationFrame(() => {
    const rect = node.getBoundingClientRect();
    const overflow = rect.bottom - (window.innerHeight - 24);
    if (overflow > 0) {
      window.scrollBy({ top: overflow + 28, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  });
}

async function showIntro(id) {
  dom.intro.classList.remove('is-hiding');
  dom.intro.classList.add('is-visible');
  await wait(TIMING.introFadeIn + TIMING.introHold, id);
  dom.intro.classList.add('is-hiding');
  await wait(TIMING.introFadeOut + 100, id);
  dom.intro.classList.remove('is-visible', 'is-hiding');
}

async function showFinale(id) {
  dom.experience.classList.add('is-finale');
  root.classList.remove('is-playing'); // vuelve a permitirse el scroll
  for (const node of dom.reveals) {
    await wait(Number(node.dataset.delay || 0), id);
    node.classList.add('is-visible');
    keepInView(node);
  }
}

/** Ejecuta toda la experiencia: frase → ramo → celebración → mensajes. */
async function runExperience({ withIntro }) {
  const id = ++runId;
  try {
    userScrolled = false;
    root.classList.add('is-playing');
    updateShift();

    await wait(withIntro ? TIMING.introDelay : 300, id);
    if (withIntro) {
      await showIntro(id);
      await wait(TIMING.afterIntro, id);
    }

    // Base del ramo (tallos + lazo)
    dom.bouquet.classList.add('has-bundle');
    await wait(700, id);

    // Las flores, una por una
    const flowers = Array.from(dom.flowers.children);
    for (let i = 0; i < flowers.length; i++) {
      growFlower(flowers[i], id);
      if (i < flowers.length - 1) await wait(TIMING.flowerInterval, id);
    }
    await wait(TIMING.headDelay + TIMING.headGrow * 0.8, id);

    celebrate();
    await wait(TIMING.finaleGap, id);
    await showFinale(id);
  } catch (error) {
    if (error !== CANCELLED) throw error;
  }
}


/* ==========================================================================
   7. REINICIO
   ========================================================================== */
let restarting = false;

function resetScene() {
  dom.bouquet.classList.remove('has-bundle', 'is-celebrating', 'is-leaving');
  dom.experience.classList.remove('is-finale');
  dom.sparks.textContent = '';
  dom.fxLayer.textContent = '';
  dom.reveals.forEach((node) => node.classList.remove('is-visible'));
  buildFlowers();
}

async function restart() {
  if (restarting) return;
  restarting = true;
  const id = ++runId; // cancela cualquier espera pendiente
  dom.replayBtn.disabled = true;

  try {
    updateShift();
    // 1) Todo desaparece suavemente
    dom.bouquet.classList.add('is-leaving');
    dom.reveals.forEach((node) => node.classList.remove('is-visible'));
    dom.experience.classList.remove('is-finale'); // el ramo vuelve al centro
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    await wait(1400, id);

    // 2) Se limpia la escena y vuelve a empezar
    resetScene();
    dom.replayBtn.disabled = false;
    restarting = false;
    runExperience({ withIntro: TIMING.replayShowIntro });
  } catch (error) {
    restarting = false;
    dom.replayBtn.disabled = false;
    if (error !== CANCELLED) throw error;
  }
}


/* ==========================================================================
   8. MODAL (TARJETA)
   ========================================================================== */
let lastFocused = null;

function openModal() {
  lastFocused = document.activeElement;
  dom.modal.hidden = false;
  dom.experience.setAttribute('inert', '');
  requestAnimationFrame(() => {
    dom.modal.classList.add('is-open');
    dom.modalCard.focus();
  });
}

function closeModal() {
  if (dom.modal.hidden) return;
  dom.modal.classList.remove('is-open');
  dom.experience.removeAttribute('inert');
  setTimeout(() => {
    dom.modal.hidden = true;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }, reduceMotion ? 0 : 450);
}

/** Mantiene el foco del teclado dentro de la tarjeta mientras está abierta. */
function trapFocus(event) {
  if (dom.modal.hidden) return;
  if (event.key === 'Escape') { closeModal(); return; }
  if (event.key !== 'Tab') return;
  const focusables = [dom.modalX, dom.modalClose];
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dom.modalCard)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}


/* ==========================================================================
   9. INICIO
   ========================================================================== */
function applyTextTemplates() {
  const word = TOTAL_FLOWERS <= 20 ? NUMBER_WORDS[TOTAL_FLOWERS] : String(TOTAL_FLOWERS);
  const plural = TOTAL_FLOWERS === 1;

  // Frase principal: [[COUNT]] flores amarillas → "Diez flores amarillas"
  const highlight = $('.finale-quote .hl');
  if (highlight) {
    const phrase = `${capitalize(word)} ${plural ? 'flor amarilla' : 'flores amarillas'}`;
    highlight.textContent = highlight.textContent.includes('[[COUNT]] flores amarillas')
      ? highlight.textContent.replace('[[COUNT]] flores amarillas', phrase)
      : highlight.textContent.replace('[[COUNT]]', capitalize(word));
  }
  dom.bouquet.setAttribute('aria-label', `Un ramo de ${word} ${plural ? 'flor amarilla' : 'flores amarillas'}`);
}

function applyTimingVariables() {
  const style = root.style;
  style.setProperty('--intro-in', `${TIMING.introFadeIn}ms`);
  style.setProperty('--intro-out', `${TIMING.introFadeOut}ms`);
  style.setProperty('--stem-dur', `${TIMING.stemGrow}ms`);
  style.setProperty('--head-delay', `${TIMING.headDelay}ms`);
  style.setProperty('--head-dur', `${TIMING.headGrow}ms`);
}

function init() {
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  applyTimingVariables();
  applyTextTemplates();
  buildAmbient();
  buildFlowers();

  // Flor decorativa de la tarjeta
  dom.modalFlower.appendChild(createHead());
  dom.modalFlower.classList.add('is-idle');

  // Posición inicial del ramo (y ajustes cuando cambia el tamaño o cargan las fuentes)
  updateShift();
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(updateShift, 120);
  });
  window.addEventListener('orientationchange', () => setTimeout(updateShift, 300));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateShift);
  if ('ResizeObserver' in window) new ResizeObserver(updateShift).observe(dom.finale);

  // Si la persona hace scroll por su cuenta, dejamos de acompañarla automáticamente
  ['wheel', 'touchmove'].forEach((type) =>
    window.addEventListener(type, () => { userScrolled = true; }, { passive: true }));
  window.addEventListener('keydown', (event) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) userScrolled = true;
  });

  // Botones
  dom.replayBtn.addEventListener('click', restart);
  dom.cardBtn.addEventListener('click', openModal);
  dom.modalX.addEventListener('click', closeModal);
  dom.modalClose.addEventListener('click', closeModal);
  dom.modal.addEventListener('click', (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.close) closeModal();
  });
  document.addEventListener('keydown', trapFocus);

  runExperience({ withIntro: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
