function shuffle(items, random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

export function groupMembers(members, columns, random = Math.random) {
  const sorted = shuffle([...members], random);
  if (columns <= 1) return sorted;

  const bioLength = member => member.querySelector('.member-bio')?.textContent.trim().length ?? 0;
  sorted.sort((a, b) => bioLength(a) - bioLength(b));

  // A primeira linha reserva uma posição para a professora.
  const firstRow = shuffle(sorted.splice(0, columns - 1), random);
  const rows = [];
  while (sorted.length >= columns) {
    rows.push(shuffle(sorted.splice(0, columns), random));
  }
  // A linha incompleta permanece por último para não misturar os grupos.
  return [...firstRow, ...shuffle(rows, random).flat(), ...shuffle(sorted, random)];
}

/**
 * Carrossel circular de lembranças. Anda um card por vez: o card que sai de um lado
 * é movido para o outro extremo da fila, então a sequência nunca acaba.
 * As setas só aparecem quando os cards não cabem todos na tela.
 */
export function initMemories(root = document) {
  const track = root.getElementById?.('memories-track');
  if (!track) return;
  const viewport = track.parentElement;
  const [prev, next] = ['prev', 'next'].map(direction => root.querySelector(`[data-carousel="${direction}"]`));
  const view = root.defaultView;
  const reducedMotion = () => Boolean(view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  let moving = false;

  const fits = () => track.scrollWidth <= viewport.clientWidth + 1;
  function update() {
    prev.hidden = next.hidden = fits();
  }

  // Distância de um card até o próximo (largura + espaço entre eles).
  function cardStep() {
    const [first, second] = track.children;
    return second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
  }

  function slide(from, to, done) {
    const finish = () => {
      track.style.transition = 'none';
      done?.();
      track.style.transform = '';
      moving = false;
    };
    if (reducedMotion()) { finish(); return; }
    track.style.transition = 'none';
    track.style.transform = `translateX(${from}px)`;
    track.getBoundingClientRect(); // aplica a posição inicial antes de animar
    track.style.transition = 'transform .45s ease';
    track.style.transform = `translateX(${to}px)`;
    const fallback = view.setTimeout(finish, 700);
    track.addEventListener('transitionend', function onEnd(event) {
      if (event.target !== track) return; // ignora transições dos próprios cards
      track.removeEventListener('transitionend', onEnd);
      view.clearTimeout(fallback);
      finish();
    });
  }

  function move(direction) {
    if (moving || fits()) return;
    moving = true;
    const distance = cardStep();
    if (direction > 0) {
      // Desliza para a esquerda e manda o primeiro card para o fim da fila.
      slide(0, -distance, () => track.append(track.firstElementChild));
    } else {
      // Traz o último card para o início e desliza para mostrá-lo.
      track.prepend(track.lastElementChild);
      slide(-distance, 0);
    }
  }

  prev.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  track.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  // Arraste no celular: um gesto horizontal anda um card; o vertical continua rolando a página.
  // Usa eventos de toque: o navegador pode cancelar os de ponteiro ao assumir o gesto.
  let start = null;
  let last = null;
  const point = touch => ({ x: touch.clientX, y: touch.clientY });
  viewport.addEventListener('touchstart', event => {
    start = event.touches.length === 1 ? point(event.touches[0]) : null;
    last = start;
  }, { passive: true });
  viewport.addEventListener('touchmove', event => {
    if (start) last = point(event.touches[0]);
  }, { passive: true });
  viewport.addEventListener('touchend', () => {
    if (!start) return;
    const dx = last.x - start.x;
    const dy = last.y - start.y;
    start = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
  }, { passive: true });
  viewport.addEventListener('touchcancel', () => { start = null; }, { passive: true });

  if (view?.ResizeObserver) new view.ResizeObserver(update).observe(viewport);
  update();
}

export function init(root = document, random = Math.random) {
  initMemories(root);
  const grid = root.querySelector('.team-grid-scroll');
  if (!grid) return;

  const members = [...grid.querySelectorAll(':scope > .team-member:not([data-team-fixed])')];
  const view = root.defaultView;
  let previousColumns = 0;
  function arrange() {
    const tracks = view?.getComputedStyle(grid).gridTemplateColumns.trim();
    const columns = tracks && tracks !== 'none' ? tracks.split(/\s+/).length : 1;
    if (columns === previousColumns) return;
    previousColumns = columns;
    grid.append(...groupMembers(members, columns, random));
  }

  arrange();
  if (view?.ResizeObserver) {
    const observer = new view.ResizeObserver(arrange);
    observer.observe(grid);
  }
}
