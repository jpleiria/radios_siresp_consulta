// Configuração pública da aplicação Web Firebase.
// Substitua os valores abaixo pelos apresentados em Firebase Console →
// Definições do projeto → As suas aplicações → Aplicação Web.
export const firebaseConfig = Object.freeze({
  apiKey: 'AIzaSyCKDHgCdKd0LHsNvP1UmsUjTlbzk6NjVY4',
  authDomain: 'siresp-consulta.firebaseapp.com',
  projectId: 'siresp-consulta',
  storageBucket: 'siresp-consulta.firebasestorage.app',
  messagingSenderId: '882703439068',
  appId: '1:882703439068:web:118d8f841e9e0b3ae19019'
});

// Email da conta Firebase partilhada para a página de consulta.
// A password nunca deve ser colocada neste ficheiro.
export const viewerEmail = 'cbsl@1002.pt';

// Endereço público do repositório de consulta no GitHub Pages.
// Exemplo: https://utilizador.github.io/radios-siresp-consulta/
// Este valor é usado apenas pelo botão "Abrir consulta" na gestão.
export const consultationUrl = 'https://jpleiria.github.io/radios_siresp_consulta';

export function isFirebaseConfigured() {
  return Object.values(firebaseConfig).every(value => value && !String(value).includes('SUBSTITUIR'))
    && viewerEmail.includes('@')
    && !viewerEmail.includes('SUBSTITUIR');
}

export function isConsultationUrlConfigured() {
  try {
    const url = new URL(consultationUrl);
    return url.protocol === 'https:' && !consultationUrl.includes('SUBSTITUIR');
  } catch {
    return false;
  }
}
