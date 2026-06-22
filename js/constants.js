// constants.js
// Listas centrais de Processos e Atividades.
// Para adicionar/remover itens no futuro, edite SOMENTE estes dois arrays.
// Os selects da tela são populados automaticamente a partir daqui (sem cascata).

export const PROCESSOS = [
  'ABASTECIMENTO',
  'CHAMADO TRANSPORTE',
  'COLETIVO',
  'LAVADOR',
  'MÃO DE OBRA',
  'SILLION',
  'SISTEMA EMBARCADO',
  'TÁXI',
  'VEÍCULOS LEVES',
  'PAUSAS E INTERVALOS',
];

export const ATIVIDADES = [
  'Abertura de Chamado',
  'Alteração de limite de cartão',
  'Alteração de senha condutor',
  'Aprovação de passageiros - Coletivo',
  'Associação de virtual',
  'Atendimento interno',
  'Atualização de cadastro - Ticket Log',
  'Bloqueio de cartão - Ticket Log',
  'Cadastro de condutor - Ticket Log',
  'Cadastro de passageiros - Coletivo',
  'Cadastro de veículo - Ticket Log',
  'Cadastro de veículos - lavador',
  'Desbloqueio de cartão - Ticket Log',
  'Disposição de informação - Geral',
  'Emissão 1/2 via',
  'Entrega de cartão coringa - Ticket log',
  'Entrega de cartão titular - Ticket log',
  'Entrega de Selo - Coletivo',
  'Geração de QR code - Lavador',
  'Informar a disponibilidade de cartão - Ticket Log',
  'Liberação de restrição - Ticket Log',
  'Logística leva e trás',
  'Solicitação de táxi',
  'Almoço (1h)',
  'Café da Manhã (15m)',
  'Lanche da Tarde (15m)',
];

// Processo que identifica uma pausa/intervalo (não conta como volume de atendimento)
export const PROCESSO_PAUSA = 'PAUSAS E INTERVALOS';

export function isPausaProcesso(processo) {
  return processo === PROCESSO_PAUSA;
}

// Janela operacional fixa, usada no Gráfico 1 do dashboard
export const HORA_INICIO_OPERACAO = 6;  // 06:00
export const HORA_FIM_OPERACAO = 18;    // 18:00

// Paleta corporativa Vale, usada também para configurar o Chart.js
export const PALETA = {
  verde: '#007E7A',
  verdeEscuro: '#00524F',
  verdeClaro: '#3FA39E',
  amarelo: '#ECB11F',
  fundo: '#F4F7F6',
  textoPrimario: '#1F2D2C',
  textoSecundario: '#5C6B6A',
  borda: '#E1E8E7',
  perigo: '#C0392B',
};
