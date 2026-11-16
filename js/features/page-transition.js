/* ========================================================================
   TRANSIÇÃO DE PÁGINA: trilhas de circuito impresso desenhadas em Canvas
   ======================================================================== */

/** Destino interno navegável, independentemente de o href ser relativo ou absoluto. */
export function navigationTarget(link, currentHref) {
  const href = link.getAttribute('href');
  if (!href || link.hasAttribute('download') || (link.target && link.target !== '_self')) return null;
  const current = new URL(currentHref);
  const target = new URL(href, current);
  if (!['http:', 'https:'].includes(target.protocol) || target.origin !== current.origin) return null;
  if (target.pathname === current.pathname && target.search === current.search) return null;
  return target.href;
}

const COLORS = ['#ABD6CD', '#C088B8', '#8773A4']; // teal, lilás e roxo da marca
const GRID = 40;            // as trilhas andam sobre esta grade, em px
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const ENTER_DURATION = 700; // ms até a página nova ser carregada
const EXIT_DURATION = 360;  // ms para o overlay sumir na página nova

const randomBetween = (min, max) => min + Math.random() * (max - min);
const pickOne = options => options[Math.floor(Math.random() * options.length)];
const easeInOut = t => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
const clamp01 = value => Math.max(0, Math.min(1, value));

/**
 * Intercepta cliques em links internos, desenha o circuito sobre a página e só então navega.
 * Na página seguinte, o evento pageshow faz o overlay desaparecer.
 */
export function initPageTransition() {
  const overlay = document.getElementById('circuitOverlay');
  const canvas = document.getElementById('circuitCanvas');
  if (!overlay || !canvas) return;

  overlay.setAttribute('aria-hidden', 'true');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    overlay.classList.remove('active');
    overlay.style.opacity = '';
    return;
  }

  const context = canvas.getContext('2d');
  let canvasWidth = 0;
  let canvasHeight = 0;
  let segments = [];
  let vias = [];
  let frameRequest = null;

  /** Sorteia as trilhas (segmentos ortogonais) e as vias (pontos nas extremidades). */
  function buildCircuit() {
    canvasWidth = canvas.width = window.innerWidth;
    canvasHeight = canvas.height = window.innerHeight;
    segments = [];
    vias = [];

    const snap = value => Math.round(value / GRID) * GRID;
    const trackCount = Math.floor((canvasWidth * canvasHeight) / 40000) + 15;

    for (let track = 0; track < trackCount; track += 1) {
      const color = pickOne(COLORS);
      const delay = randomBetween(0, 0.3);
      let x = snap(randomBetween(GRID, canvasWidth - GRID));
      let y = snap(randomBetween(GRID, canvasHeight - GRID));
      let [dx, dy] = pickOne(DIRECTIONS);
      const stepCount = Math.floor(randomBetween(2, 4));
      const points = [{ x, y }];

      for (let step = 0; step < stepCount; step += 1) {
        if (step > 0) {
          const turn = Math.random() < 0.5 ? 1 : -1;
          [dx, dy] = [-dy * turn, dx * turn];
        }
        const length = snap(randomBetween(100, 350));
        x = snap(Math.max(GRID, Math.min(canvasWidth - GRID, x + dx * length)));
        y = snap(Math.max(GRID, Math.min(canvasHeight - GRID, y + dy * length)));
        points.push({ x, y });
      }

      for (let index = 0; index < points.length - 1; index += 1) {
        const from = points[index];
        const to = points[index + 1];
        segments.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, color, width: 2, delay: delay + index * 0.06 });
      }

      vias.push({ x: points[0].x, y: points[0].y, radius: 4, color, delay });
      vias.push({ x: points.at(-1).x, y: points.at(-1).y, radius: 4, color, delay: delay + stepCount * 0.06 });
    }
  }

  /** Desenha o circuito no instante `progress` (0 a 1). */
  function drawFrame(progress) {
    context.clearRect(0, 0, canvasWidth, canvasHeight);

    for (const segment of segments) {
      const local = clamp01((progress - segment.delay) / 0.46);
      if (local <= 0) continue;

      const headX = segment.x1 + (segment.x2 - segment.x1) * easeInOut(local);
      const headY = segment.y1 + (segment.y2 - segment.y1) * easeInOut(local);
      context.beginPath();
      context.moveTo(segment.x1, segment.y1);
      context.lineTo(headX, headY);
      context.strokeStyle = segment.color;
      context.lineWidth = segment.width;
      context.globalAlpha = 0.55 * easeInOut(Math.min(1, local * 2));
      context.stroke();

      if (local < 0.97) {
        // Ponto brilhante na frente da trilha enquanto ela cresce.
        context.beginPath();
        context.arc(headX, headY, segment.width + 1.2, 0, Math.PI * 2);
        context.fillStyle = segment.color;
        context.globalAlpha = 0.9;
        context.fill();
      }
    }

    for (const via of vias) {
      const local = clamp01((progress - via.delay) / 0.2);
      if (local <= 0) continue;

      context.beginPath();
      context.arc(via.x, via.y, via.radius + 3, 0, Math.PI * 2);
      context.strokeStyle = via.color;
      context.lineWidth = 1.5;
      context.globalAlpha = local * 0.6;
      context.stroke();

      context.beginPath();
      context.arc(via.x, via.y, via.radius, 0, Math.PI * 2);
      context.strokeStyle = via.color;
      context.lineWidth = 0.8;
      context.globalAlpha = local * 0.9;
      context.stroke();

      context.beginPath();
      context.arc(via.x, via.y, via.radius * 0.42, 0, Math.PI * 2);
      context.fillStyle = '#0C1018';
      context.globalAlpha = 1;
      context.fill();
    }

    context.globalAlpha = 1;
  }

  /** Mostra o overlay e anima o circuito; chama `onDone` ao terminar. */
  function playEntrance(onDone) {
    buildCircuit();
    overlay.classList.add('active');
    const startedAt = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / ENTER_DURATION);
      drawFrame(easeInOut(progress));
      if (progress < 1) frameRequest = requestAnimationFrame(tick);
      else onDone?.();
    }

    requestAnimationFrame(tick);
  }

  /** Esmaece o overlay da página recém-carregada. */
  function fadeOut() {
    const startedAt = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / EXIT_DURATION);
      overlay.style.opacity = 1 - easeInOut(progress);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        overlay.classList.remove('active');
        overlay.style.opacity = '';
      }
    }

    requestAnimationFrame(tick);
  }

  function goTo(url) {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    playEntrance(() => { window.location.href = url; });
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link) return;

    const href = navigationTarget(link, window.location.href);
    if (!href) return;

    event.preventDefault();
    goTo(href);
  });

  window.addEventListener('pageshow', () => {
    setTimeout(fadeOut, 80);
  });
}
