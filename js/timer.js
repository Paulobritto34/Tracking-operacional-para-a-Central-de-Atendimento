// timer.js
// Cronômetro progressivo (Play/Stop) + trava contra clique duplo (dois
// cronômetros simultâneos) + modal de finalização (Processo/Atividade/Obs).

import { db, collection, query, where, getDocs } from './firebase.js';
import { state } from './state.js';
import { PROCESSOS, ATIVIDADES } from './constants.js';
import { iniciarAtendimento, encerrarAtendimento, cancelarAtendimentoAtivo } from './records.js';

const btnPlay = document.getElementById('btn-play');
const btnStop = document.getElementById('btn-stop');
const displayTempo = document.getElementById('cronometro-display');
const statusCronometro = document.getElementById('cronometro-status');
const avisoAtivo = document.getElementById('aviso-atendimento-ativo');
const anelProgresso = document.getElementById('anel-progresso');

const modalFim = document.getElementById('modal-fim-atendimento');
const formFim = document.getElementById('form-fim-atendimento');
const selectProcesso = document.getElementById('fim-processo');
const selectAtividade = document.getElementById('fim-atividade');
const inputObs = document.getElementById('fim-obs');

let intervalId = null;
let inicioAtivo = null; // Date
let idAtivo = null;

const PERIMETRO_ANEL = 2 * Math.PI * 90; // raio 90 (ver SVG no HTML)

export function popularSelects(selectEl, lista, placeholder) {
  selectEl.innerHTML = '';
  const optPlaceholder = document.createElement('option');
  optPlaceholder.value = '';
  optPlaceholder.textContent = placeholder;
  optPlaceholder.disabled = true;
  optPlaceholder.selected = true;
  selectEl.appendChild(optPlaceholder);
  for (const item of lista) {
    const opt = document.createElement('option');
    opt.value = item;
    opt.textContent = item;
    selectEl.appendChild(opt);
  }
}

export async function inicializarCronometro() {
  popularSelects(selectProcesso, PROCESSOS, 'Selecione o processo...');
  popularSelects(selectAtividade, ATIVIDADES, 'Selecione a atividade...');
  anelProgresso.style.strokeDasharray = `${PERIMETRO_ANEL}`;
  await verificarAtendimentoEmAndamento();
}

// Garante que, mesmo após um F5, o operador não perca o cronômetro em curso
// e não consiga abrir um segundo ao mesmo tempo.
async function verificarAtendimentoEmAndamento() {
  const q = query(
    collection(db, 'atendimentos'),
    where('uid', '==', state.user.uid),
    where('status', '==', 'em_andamento')
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    pararVisualEAtivar(false);
    return;
  }
  const d = snap.docs[0];
  idAtivo = d.id;
  inicioAtivo = d.data().inicio?.toDate ? d.data().inicio.toDate() : new Date();
  state.atendimentoAtivo = { id: idAtivo, inicio: inicioAtivo };
  iniciarTicker();
}

btnPlay.addEventListener('click', async () => {
  if (idAtivo) {
    // Trava de double-click: já existe um atendimento em curso.
    const confirmar = window.confirm(
      'Já existe um atendimento em curso. Deseja encerrar o atual antes de iniciar um novo?'
    );
    if (!confirmar) return;
    pararTicker();
    await cancelarAtendimentoAtivo(idAtivo);
    idAtivo = null;
    inicioAtivo = null;
    state.atendimentoAtivo = null;
  }

  btnPlay.disabled = true;
  try {
    idAtivo = await iniciarAtendimento();
    inicioAtivo = new Date();
    state.atendimentoAtivo = { id: idAtivo, inicio: inicioAtivo };
    iniciarTicker();
  } finally {
    btnPlay.disabled = false;
  }
});

btnStop.addEventListener('click', () => {
  if (!idAtivo) return;
  formFim.reset();
  selectProcesso.selectedIndex = 0;
  selectAtividade.selectedIndex = 0;
  modalFim.classList.remove('escondido');
});

document.getElementById('fim-cancelar').addEventListener('click', () => {
  modalFim.classList.add('escondido');
});

formFim.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const processo = selectProcesso.value;
  const atividade = selectAtividade.value;
  const obs = inputObs.value.trim();
  if (!processo || !atividade) return;

  const btn = formFim.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  try {
    await encerrarAtendimento(idAtivo, { processo, atividade, obs }, inicioAtivo);
    pararTicker();
    idAtivo = null;
    inicioAtivo = null;
    state.atendimentoAtivo = null;
    modalFim.classList.add('escondido');
    document.dispatchEvent(new CustomEvent('atendimento-salvo'));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Salvar e encerrar';
  }
});

function iniciarTicker() {
  pararVisualEAtivar(true);
  atualizarDisplay();
  intervalId = setInterval(atualizarDisplay, 1000);
}

function pararTicker() {
  if (intervalId) clearInterval(intervalId);
  intervalId = null;
  pararVisualEAtivar(false);
  displayTempo.textContent = '00:00:00';
  anelProgresso.style.strokeDashoffset = `${PERIMETRO_ANEL}`;
}

function pararVisualEAtivar(ativo) {
  btnPlay.classList.toggle('escondido', ativo);
  btnStop.classList.toggle('escondido', !ativo);
  statusCronometro.textContent = ativo ? 'Atendimento em andamento' : 'Pronto para iniciar';
  avisoAtivo.classList.toggle('escondido', !ativo);
}

function atualizarDisplay() {
  if (!inicioAtivo) return;
  const segundosTotais = Math.max(0, Math.floor((Date.now() - inicioAtivo.getTime()) / 1000));
  displayTempo.textContent = formatarHMS(segundosTotais);

  // Animação do anel: completa uma volta a cada 5 minutos (visual, sem
  // significado de "meta"), só para dar sensação de progresso ao vivo.
  const fracao = (segundosTotais % 300) / 300;
  anelProgresso.style.strokeDashoffset = `${PERIMETRO_ANEL * (1 - fracao)}`;
}

function formatarHMS(segundos) {
  const h = String(Math.floor(segundos / 3600)).padStart(2, '0');
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
