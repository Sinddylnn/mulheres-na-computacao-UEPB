const $ = selector => document.querySelector(selector);
const form = $('#import-form');
const status = $('#status');
let token, plan, working = false;
const bytes = value => value < 1024 * 1024 ? `${(value / 1024).toFixed(0)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
function message(text, error = false) { status.textContent = text; status.dataset.error = String(error); }
function busy(value) {
  working = value;
  $('#fields').disabled = value;
  $('#confirm').disabled = value;
  $('#cancel').disabled = value;
  form.setAttribute('aria-busy', String(value));
  $('#preview').setAttribute('aria-busy', String(value));
}
async function request(url, body, multipart = false) {
  const response = await fetch(url, { method: 'POST', headers: { 'X-Import-Token': token,
    ...(multipart ? {} : { 'Content-Type': 'application/json' }) }, body: multipart ? body : JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a operação.');
  return result;
}
function clearPreview() {
  plan = null;
  $('#preview').hidden = true;
  $('#success').hidden = true;
  $('#photo-grid').replaceChildren();
}
function updateSelection() {
  clearPreview();
  message('');
  const files = [...$('#photos').files];
  const total = files.reduce((sum, file) => sum + file.size, 0);
  $('#file-summary').textContent = files.length ? `${files.length} foto(s) selecionada(s) · ${bytes(total)}` : 'Nenhuma foto selecionada.';
  const invalid = files.length > 20 || total > 60 * 1024 * 1024 || files.some(file => file.size > 15 * 1024 * 1024);
  if (invalid) message('Selecione até 20 fotos, com até 15 MB por foto e 60 MB no total.', true);
  $('#preview-button').disabled = !token || !files.length || invalid;
  const schools = $('#category').value === 'escolas';
  $('#date-field').hidden = schools;
  if (schools) $('#date').value = '';
}
form.addEventListener('change', updateSelection);
form.addEventListener('input', () => { if (plan) { clearPreview(); message('A seleção mudou. Gere uma nova prévia.'); } });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (working || !token) return;
  const data = new FormData(form);
  clearPreview();
  busy(true);
  message('Convertendo as fotos e preparando a prévia…');
  try {
    plan = await request('/api/preview', data, true);
    $('#destination').textContent = `${plan.category === 'escolas' ? 'Escolas' : 'Encontros'} · ${plan.date}`;
    const original = plan.photos.reduce((sum, photo) => sum + photo.inputBytes, 0);
    const optimized = plan.photos.reduce((sum, photo) => sum + photo.outputBytes + photo.thumbnailBytes, 0);
    $('#totals').textContent = `${plan.photos.length} foto(s) · Originais: ${bytes(original)} · Fotos WebP + miniaturas: ${bytes(optimized)}`;
    for (const photo of plan.photos) {
      const card = $('#photo-template').content.cloneNode(true);
      card.querySelector('img').src = photo.previewUrl;
      card.querySelector('img').alt = `Prévia de ${photo.name}`;
      card.querySelector('h3').textContent = photo.name;
      card.querySelector('.dimensions').textContent = `${photo.width} × ${photo.height} px · WebP`;
      card.querySelector('.sizes').textContent = `${bytes(photo.inputBytes)} → ${bytes(photo.outputBytes)} · Miniatura: ${bytes(photo.thumbnailBytes)}`;
      $('#photo-grid').append(card);
    }
    $('#preview').hidden = false;
    message('Prévia pronta. Confira as fotos antes de adicionar.');
    $('#preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { message(error.message, true); }
  finally { busy(false); }
});
$('#confirm').addEventListener('click', async () => {
  if (!plan || working) return;
  busy(true);
  message('Adicionando as fotos à galeria…');
  try {
    const result = await request('/api/commit', { id: plan.id });
    clearPreview();
    $('#success-message').textContent = `${result.count} foto(s) adicionada(s). As fotos anteriores foram mantidas e uma cópia do cadastro anterior foi salva.`;
    $('#success').hidden = false;
    $('#photos').value = '';
    $('#file-summary').textContent = 'Nenhuma foto selecionada.';
    $('#preview-button').disabled = true;
    message('Importação concluída.');
    $('#success').focus();
  } catch (error) { message(error.message, true); }
  finally { busy(false); }
});
$('#cancel').addEventListener('click', async () => {
  if (!plan || working) return;
  busy(true);
  try {
    await request('/api/cancel', { id: plan.id });
    clearPreview();
    message('Prévia cancelada. A galeria não foi alterada.');
  } catch (error) { message(error.message, true); }
  finally { busy(false); }
});
$('#new-batch').addEventListener('click', () => { clearPreview(); message(''); $('#photos').focus(); });
$('#theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme').setAttribute('aria-pressed', String(dark));
  $('#theme').textContent = dark ? 'Tema claro' : 'Tema escuro';
});
window.addEventListener('beforeunload', event => { if (working) { event.preventDefault(); event.returnValue = ''; } });
try {
  const response = await fetch('/api/session', { cache: 'no-store' });
  if (!response.ok) throw new Error('Não foi possível iniciar a sessão.');
  ({ token } = await response.json());
  updateSelection();
} catch { message('Não foi possível conectar à ferramenta. Confira o terminal e recarregue a página.', true); }
