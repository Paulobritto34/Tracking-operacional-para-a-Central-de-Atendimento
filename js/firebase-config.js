// firebase-config.js
//
// >>> SUBSTITUA pelos dados do SEU projeto Firebase <<<
// Console: https://console.firebase.google.com  ->  Configurações do projeto -> Geral
// -> "Seus apps" -> app Web -> "Config" (firebaseConfig).
//
// Antes de usar o sistema:
// 1. Crie um projeto no Firebase.
// 2. Ative Authentication -> Sign-in method -> E-mail/senha.
// 3. Ative Firestore Database (modo produção) e publique as regras do
//    arquivo firestore.rules (na raiz deste projeto).
// 4. Crie os usuários (operadores/liderança) em Authentication -> Users
//    (e-mail + senha). O cadastro de Nome/Sobrenome é feito pelo próprio
//    usuário no primeiro acesso, dentro do sistema.

export const firebaseConfig = {
  apiKey: "AIzaSyAAFa1UDmLkIxgLynBayiB3esVqX2ecozs",
  authDomain: "tracking-operacional.firebaseapp.com",
  projectId: "tracking-operacional",
  storageBucket: "tracking-operacional.firebasestorage.app",
  messagingSenderId: "568172982961",
  appId: "1:568172982961:web:a76a0803e49461e688a890",
  measurementId: "G-QJ25R24EW8"
};
