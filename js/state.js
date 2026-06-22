// state.js
// Estado compartilhado em memória entre os módulos da aplicação.
// (Não é um "banco local": é só um objeto JS vivo durante a sessão da página.)

export const state = {
  // Preenchido depois do login + leitura do Firestore (coleção "usuarios")
  user: {
    uid: null,
    email: null,
    nome: '',
    sobrenome: '',
    role: 'operador', // 'operador' | 'lideranca'
  },

  // Atendimento em andamento (cronômetro rodando), ou null
  atendimentoAtivo: null, // { id, inicio: Date }

  // Cache do período atual selecionado no dashboard, para reaproveitar
  // entre o desenho dos gráficos e a tabela/exportação
  dashboard: {
    periodo: 'hoje',
    registros: [], // array de atendimentos já carregados do Firestore
  },
};

export function nomeCompleto() {
  return [state.user.nome, state.user.sobrenome].filter(Boolean).join(' ').trim();
}

export function isLideranca() {
  return state.user.role === 'lideranca';
}
