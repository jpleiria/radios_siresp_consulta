const RAW_DATA_URL = 'https://raw.githubusercontent.com/jpleiria/radios_siresp_consulta/main/dados-siresp.json';
const DATA_URL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'dados-siresp.json' : RAW_DATA_URL;
const ACCESS_CODE_HASH = '4f52cc46f313cfe03dc5d9a4c5dc826978d420dc9331420711c3fde8efaba183';
const SESSION_KEY = 'cbsleiria.consulta.siresp.session';
const CACHE_KEY = 'cbsleiria.consulta.siresp.lastPublication';
const FIELD_KEYS = ['portableNumber','type','issi','serialNumber','brand','model','allocatedTo','status','location'];
const FILTERS = {
  type: 'consultation-type',
  status: 'consultation-status',
  location: 'consultation-location',
  allocatedTo: 'consultation-allocated',
  brand: 'consultation-brand',
  model: 'consultation-model'
};
const $ = id => document.getElementById(id);

let records = [];
let sort = { key: 'portableNumber', direction: 1 };

function normalized(value) {
  return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]));
}

function statusClass(value) {
  return String(value || '').replace(/[^A-Za-zÀ-ÿ]/g, '');
}

function setMessage(text, error = false) {
  $('consultation-message').textContent = text;
  $('consultation-message').classList.toggle('error', error);
}

function normalizedRecord(record) {
  return Object.fromEntries(FIELD_KEYS.map(key => [key, String(record?.[key] || '').trim()]));
}

function validatePublication(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-publication');
  if (value.application !== 'CBSLeiria Consulta SIRESP' || value.schemaVersion !== 1) throw new Error('invalid-schema');
  if (!Array.isArray(value.records) || !Number.isInteger(value.recordCount) || value.recordCount !== value.records.length) throw new Error('invalid-records');
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) throw new Error('invalid-date');
  return {
    application: value.application,
    schemaVersion: value.schemaVersion,
    exportedAt: value.exportedAt,
    recordCount: value.recordCount,
    records: value.records.map(normalizedRecord)
  };
}

function uniqueValues(field) {
  return [...new Set(records.map(record => record[field]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base', numeric: true }));
}

function updateSelect(id, values, emptyLabel) {
  const select = $(id);
  const selected = select.value;
  select.innerHTML = `<option value="">${emptyLabel}</option>${values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('')}`;
  if (values.includes(selected)) select.value = selected;
}

function renderFilterOptions() {
  updateSelect('consultation-type', uniqueValues('type'), 'Todos');
  updateSelect('consultation-status', uniqueValues('status'), 'Todos');
  updateSelect('consultation-location', uniqueValues('location'), 'Todas');
  updateSelect('consultation-allocated', uniqueValues('allocatedTo'), 'Todos');
  updateSelect('consultation-brand', uniqueValues('brand'), 'Todas');
  updateSelect('consultation-model', uniqueValues('model'), 'Todos');
}

function filteredRecords() {
  const query = normalized($('consultation-search').value);
  return records.filter(record => {
    if (query && !normalized(FIELD_KEYS.map(key => record[key]).join(' ')).includes(query)) return false;
    return Object.entries(FILTERS).every(([field, id]) => !$(id).value || record[field] === $(id).value);
  }).sort((a, b) => String(a[sort.key] || '').localeCompare(String(b[sort.key] || ''), 'pt', { sensitivity: 'base', numeric: true }) * sort.direction);
}

function renderCards() {
  $('consultation-cards').innerHTML = `
    <div class="summary-card"><strong>${records.length}</strong><span>Total SIRESP</span></div>
    <div class="summary-card"><strong>${records.filter(record => record.status === 'Operacional').length}</strong><span>Operacionais</span></div>
    <div class="summary-card warning"><strong>${records.filter(record => record.status === 'Manutenção').length}</strong><span>Em manutenção</span></div>
    <div class="summary-card danger-card"><strong>${records.filter(record => record.status === 'Abatido').length}</strong><span>Abatidos</span></div>`;
}

function renderTable() {
  const visible = filteredRecords();
  $('consultation-result-summary').textContent = `${visible.length} de ${records.length} equipamento${records.length === 1 ? '' : 's'} SIRESP`;
  $('consultation-records').innerHTML = visible.length ? visible.map(record => `
    <tr>
      <td>${escapeHtml(record.portableNumber || '—')}</td>
      <td>${escapeHtml(record.type)}</td>
      <td>${escapeHtml(record.issi)}</td>
      <td>${escapeHtml(record.serialNumber)}</td>
      <td>${escapeHtml(record.brand)}</td>
      <td>${escapeHtml(record.model)}</td>
      <td>${escapeHtml(record.allocatedTo)}</td>
      <td><span class="status ${statusClass(record.status)}">${escapeHtml(record.status)}</span></td>
      <td>${escapeHtml(record.location)}</td>
    </tr>`).join('') : '<tr><td colspan="9" class="empty">Nenhum equipamento corresponde aos filtros.</td></tr>';

  document.querySelectorAll('[data-consultation-sort]').forEach(header => {
    header.classList.toggle('sort-asc', header.dataset.consultationSort === sort.key && sort.direction === 1);
    header.classList.toggle('sort-desc', header.dataset.consultationSort === sort.key && sort.direction === -1);
  });
}

function renderAll() {
  renderFilterOptions();
  renderCards();
  renderTable();
}

function displayPublication(publication, cached = false) {
  records = publication.records;
  const date = new Date(publication.exportedAt);
  $('consultation-updated').textContent = `${cached ? 'Última cópia disponível' : 'Última atualização'}: ${new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(date)} · ${records.length} rádio(s)`;
  renderAll();
}

function cachedPublication() {
  try {
    return validatePublication(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'));
  } catch {
    return null;
  }
}

async function loadPublication() {
  setMessage('A carregar os dados SIRESP…');
  try {
    const separator = DATA_URL.includes('?') ? '&' : '?';
    const response = await fetch(`${DATA_URL}${separator}v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`http-${response.status}`);
    const publication = validatePublication(await response.json());
    localStorage.setItem(CACHE_KEY, JSON.stringify(publication));
    displayPublication(publication);
    setMessage('');
  } catch {
    const fallback = cachedPublication();
    if (fallback) {
      displayPublication(fallback, true);
      setMessage('Não foi possível obter a versão mais recente. Está a ser apresentada a última cópia guardada neste navegador.', true);
    } else {
      records = [];
      renderAll();
      $('consultation-updated').textContent = 'Dados indisponíveis.';
      setMessage('Não foi possível carregar dados-siresp.json. Confirme se o ficheiro existe na raiz do repositório de consulta.', true);
    }
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function showAuthenticatedView() {
  $('consultation-login').classList.add('hidden');
  $('consultation-content').classList.remove('hidden');
  $('consultation-content').classList.add('active');
  $('consultation-session-actions').classList.remove('hidden');
  loadPublication();
}

function showLoginView() {
  $('consultation-login').classList.remove('hidden');
  $('consultation-content').classList.add('hidden');
  $('consultation-content').classList.remove('active');
  $('consultation-session-actions').classList.add('hidden');
  $('consultation-password').value = '';
  $('consultation-login-error').textContent = '';
  setMessage('');
}

async function login(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  $('consultation-login-error').textContent = '';
  submit.disabled = true;
  try {
    const valid = await sha256($('consultation-password').value.trim()) === ACCESS_CODE_HASH;
    if (!valid) {
      $('consultation-login-error').textContent = 'Código de acesso incorreto.';
      return;
    }
    sessionStorage.setItem(SESSION_KEY, '1');
    $('consultation-password').value = '';
    showAuthenticatedView();
  } catch {
    $('consultation-login-error').textContent = 'Não foi possível validar o código neste navegador.';
  } finally {
    submit.disabled = false;
  }
}

function signOut() {
  sessionStorage.removeItem(SESSION_KEY);
  records = [];
  showLoginView();
}

function clearFilters() {
  $('consultation-search').value = '';
  Object.values(FILTERS).forEach(id => { $(id).value = ''; });
  renderTable();
}

function boot() {
  $('consultation-login-form').addEventListener('submit', login);
  $('consultation-sign-out').addEventListener('click', signOut);
  $('consultation-clear').addEventListener('click', clearFilters);
  $('consultation-search').addEventListener('input', renderTable);
  Object.values(FILTERS).forEach(id => $(id).addEventListener('change', renderTable));
  document.querySelectorAll('[data-consultation-sort]').forEach(header => header.addEventListener('click', () => {
    const key = header.dataset.consultationSort;
    sort = { key, direction: sort.key === key ? -sort.direction : 1 };
    renderTable();
  }));

  $('consultation-login-form').querySelector('button').disabled = false;
  if (sessionStorage.getItem(SESSION_KEY) === '1') showAuthenticatedView();
  else showLoginView();
}

boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
