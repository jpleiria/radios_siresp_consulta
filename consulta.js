import { firebaseConfig, isFirebaseConfigured, viewerEmail } from './firebase-config.js';

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

let auth;
let database;
let firebaseApi;
let unsubscribePublication;
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

function authenticationError(error) {
  const code = String(error?.code || '');
  if (code.includes('invalid-credential')) return 'Password incorreta.';
  if (code.includes('too-many-requests')) return 'Demasiadas tentativas. Aguarde antes de voltar a tentar.';
  if (code.includes('network-request-failed') || !navigator.onLine) return 'Não foi possível ligar ao Firebase.';
  return 'Não foi possível iniciar sessão.';
}

function publicationError(error) {
  const code = String(error?.code || '');
  if (code.includes('permission-denied')) return 'Esta conta não tem autorização para consultar os dados.';
  if (code.includes('unavailable') || !navigator.onLine) return 'Ligação indisponível. Verifique a Internet.';
  return 'Não foi possível carregar a publicação SIRESP.';
}

function normalizedRecord(record) {
  return Object.fromEntries(['id', ...FIELD_KEYS].map(key => [key, String(record?.[key] || '')]));
}

function uniqueValues(field) {
  return [...new Set(records.map(record => record[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt', { sensitivity: 'base', numeric: true }));
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

function displayUpdatedAt(value, count) {
  const date = value?.toDate?.();
  $('consultation-updated').textContent = date
    ? `Última sincronização: ${new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(date)} · ${count} rádio(s)`
    : `Publicação disponível · ${count} rádio(s)`;
}

function subscribeToPublication() {
  unsubscribePublication?.();
  setMessage('A carregar a publicação SIRESP…');
  unsubscribePublication = firebaseApi.onSnapshot(firebaseApi.doc(database, 'publicacoes', 'siresp'), snapshot => {
    if (!snapshot.exists()) {
      records = [];
      renderAll();
      $('consultation-updated').textContent = 'Ainda não foi realizada a primeira sincronização.';
      setMessage('A publicação SIRESP ainda não existe.', true);
      return;
    }
    const data = snapshot.data();
    records = Array.isArray(data.records) ? data.records.map(normalizedRecord) : [];
    displayUpdatedAt(data.updatedAt, records.length);
    renderAll();
    setMessage('');
  }, error => setMessage(publicationError(error), true));
}

async function login(event) {
  event.preventDefault();
  const submit = event.currentTarget.querySelector('button[type="submit"]');
  $('consultation-login-error').textContent = '';
  submit.disabled = true;
  try {
    await firebaseApi.signInWithEmailAndPassword(auth, viewerEmail, $('consultation-password').value);
    $('consultation-password').value = '';
  } catch (error) {
    $('consultation-login-error').textContent = authenticationError(error);
  } finally {
    submit.disabled = false;
  }
}

function clearFilters() {
  $('consultation-search').value = '';
  Object.values(FILTERS).forEach(id => { $(id).value = ''; });
  renderTable();
}

async function boot() {
  $('consultation-login-form').addEventListener('submit', login);
  $('consultation-sign-out').addEventListener('click', () => auth && firebaseApi.signOut(auth));
  $('consultation-clear').addEventListener('click', clearFilters);
  $('consultation-search').addEventListener('input', renderTable);
  Object.values(FILTERS).forEach(id => $(id).addEventListener('change', renderTable));
  document.querySelectorAll('[data-consultation-sort]').forEach(header => header.addEventListener('click', () => {
    const key = header.dataset.consultationSort;
    sort = { key, direction: sort.key === key ? -sort.direction : 1 };
    renderTable();
  }));

  if (!isFirebaseConfigured()) {
    $('consultation-login-form').querySelector('button').disabled = true;
    $('consultation-login-error').textContent = 'Firebase por configurar. Preencha o ficheiro firebase-config.js antes de publicar.';
    return;
  }

  try {
    const [appSdk, authSdk, firestoreSdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js')
    ]);
    firebaseApi = { ...authSdk, ...firestoreSdk };
    const app = appSdk.initializeApp(firebaseConfig, 'cbsleiria-consultation');
    auth = authSdk.getAuth(app);
    database = firestoreSdk.getFirestore(app);
    await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
    $('consultation-login-form').querySelector('button').disabled = false;
    authSdk.onAuthStateChanged(auth, user => {
      const authenticated = !!user;
      $('consultation-login').classList.toggle('hidden', authenticated);
      $('consultation-content').classList.toggle('hidden', !authenticated);
      $('consultation-content').classList.toggle('active', authenticated);
      $('consultation-session-actions').classList.toggle('hidden', !authenticated);
      if (authenticated) subscribeToPublication();
      else {
        unsubscribePublication?.();
        unsubscribePublication = undefined;
        records = [];
        $('consultation-password').value = '';
        setMessage('');
      }
    });
  } catch (error) {
    $('consultation-login-error').textContent = navigator.onLine ? 'Configuração Firebase inválida.' : 'Sem ligação ao Firebase.';
  }
}

boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
