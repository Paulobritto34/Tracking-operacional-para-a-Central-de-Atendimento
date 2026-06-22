// records.js
// Operações de leitura/escrita da coleção "atendimentos" + a regra de
// trava de segurança: um registro só pode ser editado/excluído pelo próprio
// operador no mesmo dia (turno). Depois disso, só quem tem role "lideranca".

import {
  db,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from './firebase.js';
import { state, isLideranca } from './state.js';
import { isPausaProcesso } from './constants.js';

const COLECAO = 'atendimentos';

export function mesmoDia(dataA, dataB) {
  return (
    dataA.getFullYear() === dataB.getFullYear() &&
    dataA.getMonth() === dataB.getMonth() &&
    dataA.getDate() === dataB.getDate()
  );
}

// Regra central de permissão de edição/exclusão.
// `inicio` deve ser um objeto Date (já convertido do Timestamp do Firestore).
export function podeEditar(registro) {
  if (isLideranca()) return true;
  if (registro.uid !== state.user.uid) return false;
  return mesmoDia(registro.inicio, new Date());
}

export async function iniciarAtendimento() {
  const docRef = await addDoc(collection(db, COLECAO), {
    uid: state.user.uid,
    nomeOperador: `${state.user.nome} ${state.user.sobrenome}`.trim(),
    status: 'em_andamento',
    inicio: serverTimestamp(),
    fim: null,
    duracaoSegundos: null,
    processo: null,
    atividade: null,
    obs: '',
    isPausa: false,
    origem: 'cronometro',
    criadoEm: serverTimestamp(),
  });
  return docRef.id;
}

export async function encerrarAtendimento(id, { processo, atividade, obs }, inicioDate) {
  const fim = new Date();
  const duracaoSegundos = Math.max(0, Math.round((fim.getTime() - inicioDate.getTime()) / 1000));
  await updateDoc(doc(db, COLECAO, id), {
    status: 'concluido',
    fim: Timestamp.fromDate(fim),
    duracaoSegundos,
    processo,
    atividade,
    obs: obs || '',
    isPausa: isPausaProcesso(processo),
    editadoEm: serverTimestamp(),
  });
}

export async function cancelarAtendimentoAtivo(id) {
  // Usado quando o usuário confirma "encerrar o atual antes de iniciar um novo"
  // sem preencher dados (ex.: foi engano). Marca como cancelado em vez de apagar,
  // para manter rastreabilidade.
  await updateDoc(doc(db, COLECAO, id), {
    status: 'cancelado',
    fim: Timestamp.fromDate(new Date()),
    editadoEm: serverTimestamp(),
  });
}

export async function criarLancamentoManual({ processo, atividade, obs, inicioDate, fimDate }) {
  const duracaoSegundos = Math.max(0, Math.round((fimDate.getTime() - inicioDate.getTime()) / 1000));
  await addDoc(collection(db, COLECAO), {
    uid: state.user.uid,
    nomeOperador: `${state.user.nome} ${state.user.sobrenome}`.trim(),
    status: 'concluido',
    inicio: Timestamp.fromDate(inicioDate),
    fim: Timestamp.fromDate(fimDate),
    duracaoSegundos,
    processo,
    atividade,
    obs: obs || '',
    isPausa: isPausaProcesso(processo),
    origem: 'manual',
    criadoEm: serverTimestamp(),
  });
}

export async function atualizarAtendimento(id, { processo, atividade, obs, inicioDate, fimDate }) {
  const duracaoSegundos = Math.max(0, Math.round((fimDate.getTime() - inicioDate.getTime()) / 1000));
  await updateDoc(doc(db, COLECAO, id), {
    inicio: Timestamp.fromDate(inicioDate),
    fim: Timestamp.fromDate(fimDate),
    duracaoSegundos,
    processo,
    atividade,
    obs: obs || '',
    isPausa: isPausaProcesso(processo),
    editadoEm: serverTimestamp(),
  });
}

export async function excluirAtendimento(id) {
  await deleteDoc(doc(db, COLECAO, id));
}
