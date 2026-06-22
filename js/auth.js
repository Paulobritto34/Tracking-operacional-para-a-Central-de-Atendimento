// auth.js
// Login (e-mail/senha), carregamento do perfil em "usuarios/{uid}" e o modal
// obrigatório de primeiro acesso (Nome e Sobrenome).

import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from './firebase.js'
import { state } from './state.js'

const telaLogin = document.getElementById('tela-login')
const telaApp = document.getElementById('app')
const formLogin = document.getElementById('form-login')
const loginErro = document.getElementById('login-erro')
const btnLogout = document.getElementById('btn-logout')
const nomeOperadorTopo = document.getElementById('nome-operador-topo')

const modalPrimeiroAcesso = document.getElementById('modal-primeiro-acesso')
const formPrimeiroAcesso = document.getElementById('form-primeiro-acesso')
const inputNome = document.getElementById('pa-nome')
const inputSobrenome = document.getElementById('pa-sobrenome')

let onLoginSucesso = () => {}

export function aoLogar(callback) {
  onLoginSucesso = callback
}

formLogin.addEventListener('submit', async ev => {
  ev.preventDefault()
  loginErro.classList.add('escondido')
  const email = document.getElementById('login-email').value.trim()
  const senha = document.getElementById('login-senha').value
  const btn = formLogin.querySelector('button[type="submit"]')
  btn.disabled = true
  btn.textContent = 'Entrando...'
  try {
    await signInWithEmailAndPassword(auth, email, senha)
    // onAuthStateChanged cuida do resto
  } catch (err) {
    loginErro.textContent = mensagemErroAuth(err)
    loginErro.classList.remove('escondido')
  } finally {
    btn.disabled = false
    btn.textContent = 'Entrar'
  }
})

btnLogout.addEventListener('click', async () => {
  await signOut(auth)
})

formPrimeiroAcesso.addEventListener('submit', async ev => {
  ev.preventDefault()
  const nome = inputNome.value.trim()
  const sobrenome = inputSobrenome.value.trim()
  if (!nome || !sobrenome) return

  const btn = formPrimeiroAcesso.querySelector('button[type="submit"]')
  btn.disabled = true
  btn.textContent = 'Salvando...'

  await setDoc(doc(db, 'usuarios', state.user.uid), {
    nome,
    sobrenome,
    email: state.user.email,
    role: 'operador', // padrão; a Liderança ajusta manualmente no Firestore Console
    criadoEm: serverTimestamp()
  })

  state.user.nome = nome
  state.user.sobrenome = sobrenome
  fecharModalPrimeiroAcesso()
  finalizarEntrada()

  btn.disabled = false
  btn.textContent = 'Salvar e continuar'
})

onAuthStateChanged(auth, async firebaseUser => {
  if (!firebaseUser) {
    state.user = {
      uid: null,
      email: null,
      nome: '',
      sobrenome: '',
      role: 'operador'
    }
    telaApp.classList.add('escondido')
    telaLogin.classList.remove('escondido')
    return
  }

  state.user.uid = firebaseUser.uid
  state.user.email = firebaseUser.email

  const ref = doc(db, 'usuarios', firebaseUser.uid)
  const snap = await getDoc(ref)

  if (!snap.exists() || !snap.data().nome) {
    // Primeiro acesso: precisa cadastrar Nome e Sobrenome antes de usar o sistema
    abrirModalPrimeiroAcesso()
    return
  }

  const dados = snap.data()
  state.user.nome = dados.nome || ''
  state.user.sobrenome = dados.sobrenome || ''
  state.user.role = dados.role === 'lideranca' ? 'lideranca' : 'operador'

  finalizarEntrada()
})

function abrirModalPrimeiroAcesso() {
  telaLogin.classList.add('escondido')
  telaApp.classList.add('escondido')
  modalPrimeiroAcesso.classList.remove('escondido')
  inputNome.value = ''
  inputSobrenome.value = ''
  setTimeout(() => inputNome.focus(), 50)
}

function fecharModalPrimeiroAcesso() {
  modalPrimeiroAcesso.classList.add('escondido')
}

function finalizarEntrada() {
  telaLogin.classList.add('escondido')
  modalPrimeiroAcesso.classList.add('escondido')
  telaApp.classList.remove('escondido')
  nomeOperadorTopo.textContent =
    `${state.user.nome} ${state.user.sobrenome}`.trim()
  document.body.classList.toggle(
    'papel-lideranca',
    state.user.role === 'lideranca'
  )
  onLoginSucesso()
}

function mensagemErroAuth(err) {
  const codigo = err && err.code ? err.code : ''
  if (
    codigo.includes('invalid-credential') ||
    codigo.includes('wrong-password') ||
    codigo.includes('user-not-found')
  ) {
    return 'E-mail ou senha inválidos.'
  }
  if (codigo.includes('too-many-requests')) {
    return 'Muitas tentativas. Aguarde um momento e tente novamente.'
  }
  return 'Não foi possível entrar. Verifique sua conexão e tente novamente.'
}
