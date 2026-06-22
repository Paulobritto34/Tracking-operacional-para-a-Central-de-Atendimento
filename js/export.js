// export.js
// Exportação da tabela histórica visível (já filtrada pelo período) em
// CSV e XLSX. XLSX usa a biblioteca SheetJS, carregada via CDN no index.html
// (window.XLSX).

const CABECALHO = [
  'Data', 'Hora Início', 'Hora Fim', 'Duração', 'Operador',
  'Processo', 'Atividade', 'Pausa', 'Observação', 'Origem',
];

function registroParaLinha(r) {
  return [
    formatarData(r.inicio),
    formatarHora(r.inicio),
    r.fim ? formatarHora(r.fim) : '',
    formatarDuracao(r.duracaoSegundos),
    r.nomeOperador || '',
    r.processo || '',
    r.atividade || '',
    r.isPausa ? 'Sim' : 'Não',
    r.obs || '',
    r.origem === 'manual' ? 'Manual' : 'Cronômetro',
  ];
}

export function exportarCSV(registros, nomeArquivo = 'atendimentos.csv') {
  const linhas = [CABECALHO, ...registros.map(registroParaLinha)];
  const csv = linhas
    .map((linha) => linha.map(escaparCelulaCSV).join(';'))
    .join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  baixarBlob(blob, nomeArquivo);
}

export function exportarXLSX(registros, nomeArquivo = 'atendimentos.xlsx') {
  const dados = [CABECALHO, ...registros.map(registroParaLinha)];
  const ws = window.XLSX.utils.aoa_to_sheet(dados);
  ws['!cols'] = CABECALHO.map(() => ({ wch: 18 }));
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, 'Atendimentos');
  window.XLSX.writeFile(wb, nomeArquivo);
}

function escaparCelulaCSV(valor) {
  const texto = String(valor ?? '');
  if (/[;"\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function baixarBlob(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatarData(d) {
  return d.toLocaleDateString('pt-BR');
}
function formatarHora(d) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatarDuracao(segundos) {
  if (segundos == null) return '';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}m`;
}
