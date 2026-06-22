// timer.js
// Cronômetro progressivo (Play/Stop) + trava contra clique duplo (dois
// cronômetros simultâneos) + atalhos de pausa com auto-stop + modal de
// finalização (Processo/Atividade/Obs).

import { db, collection, query, where, getDocs } from './firebase.js';
import { state } from './state.js';
import { PROCESSOS, ATIVIDADES, PROCESSO_PAUSA } from './constants.js';
import {
  iniciarAtendimento,
  iniciarAtendimentoPausa,
  encerrarAtendimento,
  cancelarAtendimentoAtivo,
} from './records.js';

// ── Elementos do cronômetro ──────────────────────────────────────────────────
const btnPlay           = document.getElementById('btn-play');
const btnStop           = document.getElementById('btn-stop');
const displayTempo      = document.getElementById('cronometro-display');
const statusCronometro  = document.getElementById('cronometro-status');
const avisoAtivo        = document.getElementById('aviso-atendimento-ativo');
const anelProgresso     = document.getElementById('anel-progresso');

// ── Elementos do modal de finalização ───────────────────────────────────────
const modalFim        = document.getElementById('modal-fim-atendimento');
const formFim         = document.getElementById('form-fim-atendimento');
const selectProcesso  = document.getElementById('fim-processo');
const selectAtividade = document.getElementById('fim-atividade');
const inputObs        = document.getElementById('fim-obs');
const notaPausaModal  = document.getElementById('fim-nota-pausa');
const notaPausaNome   = document.getElementById('fim-nota-pausa-nome');

// ── Estado interno ───────────────────────────────────────────────────────────
let intervalId  = null;
let inicioAtivo = null;   // Date
let idAtivo     = null;   // string (id do doc Firestore)

/** Nome da atividade de pausa em andamento, ou null se for atendimento normal. */
let pausaAtiva = null;

/** Pausa a ser iniciada automaticamente após o modal de finalização ser submetido. */
let pendingPausaAposModal = null;

const PERIMETRO_ANEL = 2 * Math.PI * 90; // raio 90 (ver SVG no HTML)

// ── Utilidade de selects ─────────────────────────────────────────────────────
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

// ── Inicialização ────────────────────────────────────────────────────────────
export async function inicializarCronometro() {
  popularSelects(selectProcesso, PROCESSOS, 'Selecione o processo...');
  popularSelects(selectAtividade, ATIVIDADES, 'Selecione a atividade...');
  anelProgresso.style.strokeDasharray = `${PERIMETRO_ANEL}`;
  await verificarAtendimentoEmAndamento();
}

/**
 * Garante que, mesmo após um F5, o operador não perca o cronômetro em curso
 * e não consiga abrir um segundo ao mesmo tempo. Restaura também o modo pausa.
 */
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
  const d     = snap.docs[0];
  const dados = d.data();
  idAtivo     = d.id;
  inicioAtivo = dados.inicio?.toDate ? dados.inicio.toDate() : new Date();
  state.atendimentoAtivo = { id: idAtivo, inicio: inicioAtivo };

  // Restaura estado de pausa caso o usuário tenha recarregado a página
  if (dados.isPausa && dados.atividade) {
    pausaAtiva = dados.atividade;
  }

  iniciarTicker();
}

// ── Botão PLAY ───────────────────────────────────────────────────────────────
btnPlay.addEventListener('click', async () => {
  if (idAtivo) {
    const confirmar = window.confirm(
      'Já existe um atendimento em curso. Deseja encerrar o atual antes de iniciar um novo?'
    );
    if (!confirmar) return;
    pararTicker();
    await cancelarAtendimentoAtivo(idAtivo);
    idAtivo     = null;
    inicioAtivo = null;
    pausaAtiva  = null;
    state.atendimentoAtivo = null;
  }

  btnPlay.disabled = true;
  try {
    idAtivo     = await iniciarAtendimento();
    inicioAtivo = new Date();
    pausaAtiva  = null;
    state.atendimentoAtivo = { id: idAtivo, inicio: inicioAtivo };
    iniciarTicker();
  } finally {
    btnPlay.disabled = false;
  }
});

// ── Botão STOP ───────────────────────────────────────────────────────────────
btnStop.addEventListener('click', () => {
  if (!idAtivo) return;
  formFim.reset();
  notaPausaModal.classList.add('escondido');

  if (pausaAtiva) {
    // Pré-preenche o modal com os dados do intervalo em andamento
    selectProcesso.value  = PROCESSO_PAUSA;
    selectAtividade.value = pausaAtiva;
  } else {
    selectProcesso.selectedIndex  = 0;
    selectAtividade.selectedIndex = 0;
  }
  modalFim.classList.remove('escondido');
});

// ── Botões de atalho de pausa ────────────────────────────────────────────────
document.querySelectorAll('.botao-atalho-pausa').forEach(btn => {
  btn.addEventListener('click', async () => {
    const atividade = btn.dataset.atividade;

    if (idAtivo) {
      if (pausaAtiva) {
        // Já em pausa — ignora clique para evitar duplo registro
        return;
      }
      // Atendimento normal em andamento: exige finalização antes de ir para pausa
      pendingPausaAposModal = atividade;
      formFim.reset();
      selectProcesso.selectedIndex  = 0;
      selectAtividade.selectedIndex = 0;
      // Exibe o banner explicativo no modal
      notaPausaNome.textContent = atividade;
      notaPausaModal.classList.remove('escondido');
      modalFim.classList.remove('escondido');
    } else {
      // Sem timer ativo: inicia a pausa diretamente
      await iniciarPausaTimer(atividade);
    }
  });
});

// ── Modal: cancelar ──────────────────────────────────────────────────────────
document.getElementById('fim-cancelar').addEventListener('click', () => {
  pendingPausaAposModal = null;
  notaPausaModal.classList.add('escondido');
  modalFim.classList.add('escondido');
});

// ── Modal: submissão ─────────────────────────────────────────────────────────
formFim.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const processo  = selectProcesso.value;
  const atividade = selectAtividade.value;
  const obs       = inputObs.value.trim();
  if (!processo || !atividade) return;

  const btn = formFim.querySelector('button[type="submit"]');
  btn.disabled    = true;
  btn.textContent = 'Salvando...';

  try {
    await encerrarAtendimento(idAtivo, { processo, atividade, obs }, inicioAtivo);

    // Captura a pausa pendente antes de limpar o estado
    const pausaAgendada   = pendingPausaAposModal;
    pendingPausaAposModal = null;
    pausaAtiva            = null;

    pararTicker();
    idAtivo     = null;
    inicioAtivo = null;
    state.atendimentoAtivo = null;

    notaPausaModal.classList.add('escondido');
    modalFim.classList.add('escondido');

    document.dispatchEvent(new CustomEvent('atendimento-salvo'));

    // Inicia a pausa automaticamente se havia sido agendada via atalho
    if (pausaAgendada) {
      await iniciarPausaTimer(pausaAgendada);
    }
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Salvar e encerrar';
  }
});

// ── Lógica de pausa ──────────────────────────────────────────────────────────

/**
 * Inicia um timer especial de pausa. O documento já é criado com
 * isPausa=true e atividade preenchida para que um F5 consiga restaurar
 * o estado sem perder o contexto de qual intervalo está em andamento.
 */
async function iniciarPausaTimer(atividade) {
  btnPlay.disabled = true;
  try {
    idAtivo     = await iniciarAtendimentoPausa(atividade);
    inicioAtivo = new Date();
    pausaAtiva  = atividade;
    state.atendimentoAtivo = { id: idAtivo, inicio: inicioAtivo };
    iniciarTicker();
  } finally {
    btnPlay.disabled = false;
  }
}

// ── Ticker (setInterval) ─────────────────────────────────────────────────────
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
  avisoAtivo.classList.toggle('escondido', !ativo);

  // Cor do anel e label de status refletem o modo atual
  if (!ativo) {
    statusCronometro.textContent = 'Pronto para iniciar';
    anelProgresso.classList.remove('modo-pausa');
  } else if (pausaAtiva) {
    statusCronometro.textContent = `⏸ ${pausaAtiva}`;
    anelProgresso.classList.add('modo-pausa');
  } else {
    statusCronometro.textContent = 'Atendimento em andamento';
    anelProgresso.classList.remove('modo-pausa');
  }
}

function atualizarDisplay() {
  if (!inicioAtivo) return;
  const segundosTotais = Math.max(
    0,
    Math.floor((Date.now() - inicioAtivo.getTime()) / 1000)
  );
  displayTempo.textContent = formatarHMS(segundosTotais);

  // Anel: uma volta completa a cada 5 minutos (apenas visual de progresso)
  const fracao = (segundosTotais % 300) / 300;
  anelProgresso.style.strokeDashoffset = `${PERIMETRO_ANEL * (1 - fracao)}`;
}

function formatarHMS(segundos) {
  const h = String(Math.floor(segundos / 3600)).padStart(2, '0');
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
  const s = String(segundos % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
