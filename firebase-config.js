// Configuração pública da aplicação Web Firebase.
// Substitua os valores abaixo pelos apresentados em Firebase Console →
// Definições do projeto → As suas aplicações → Aplicação Web.
export const firebaseConfig = Object.freeze({
  apiKey: 'SUBSTITUIR_API_KEY',
  authDomain: 'SUBSTITUIR_PROJECT_ID.firebaseapp.com',
  projectId: 'SUBSTITUIR_PROJECT_ID',
  storageBucket: 'SUBSTITUIR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'SUBSTITUIR_MESSAGING_SENDER_ID',
  appId: 'SUBSTITUIR_APP_ID'
});

// Email da conta Firebase partilhada para a página de consulta.
// A password nunca deve ser colocada neste ficheiro.
export const viewerEmail = 'SUBSTITUIR_EMAIL_CONSULTA';

// Endereço público do repositório de consulta no GitHub Pages.
// Exemplo: https://utilizador.github.io/radios-siresp-consulta/
// Este valor é usado apenas pelo botão "Abrir consulta" na gestão.
export const consultationUrl = 'SUBSTITUIR_URL_CONSULTA';

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
