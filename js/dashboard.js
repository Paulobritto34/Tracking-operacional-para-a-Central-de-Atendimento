// dashboard.js
// Visão executiva: filtro de período, cards de KPI, 5 gráficos (Chart.js),
// tabela histórica com edição/exclusão (respeitando a trava de segurança)
// e exportação CSV/XLSX.

import {
  db,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp
} from './firebase.js'
import {
  PALETA,
  HORA_INICIO_OPERACAO,
  HORA_FIM_OPERACAO,
  PROCESSOS,
  ATIVIDADES
} from './constants.js'
import {
  podeEditar,
  atualizarAtendimento,
  excluirAtendimento
} from './records.js'
import { exportarCSV, exportarXLSX } from './export.js'
import { popularSelects } from './timer.js'

// ── Referências DOM ──────────────────────────────────────────────────────────

const selectPeriodo   = document.getElementById('dash-periodo')
const btnAtualizar    = document.getElementById('dash-atualizar')
const cardVolume      = document.getElementById('card-volume')
const cardTMA         = document.getElementById('card-tma')
const cardHoras       = document.getElementById('card-horas')
const corpoTabela     = document.getElementById('tabela-historico-corpo')
const tabelaVazia     = document.getElementById('tabela-historico-vazia')
const btnExportarCSV  = document.getElementById('btn-exportar-csv')
const btnExportarXLSX = document.getElementById('btn-exportar-xlsx')

const modalEdicao   = document.getElementById('modal-edicao')
const formEdicao    = document.getElementById('form-edicao')
const editProcesso  = document.getElementById('edit-processo')
const editAtividade = document.getElementById('edit-atividade')
const editData      = document.getElementById('edit-data')
const editHoraInicio= document.getElementById('edit-hora-inicio')
const editHoraFim   = document.getElementById('edit-hora-fim')
const editObs       = document.getElementById('edit-obs')
let idEmEdicao = null

// ── Instâncias de gráficos ───────────────────────────────────────────────────

let chartVolume   = null
let chartTMA      = null
let chartHoras    = null
let chartProcesso = null
let chartRanking  = null

let registrosAtuais = []

// ── Inicialização ────────────────────────────────────────────────────────────

export function inicializarDashboard() {
  popularSelects(editProcesso, PROCESSOS, 'Selecione o processo...')
  popularSelects(editAtividade, ATIVIDADES, 'Selecione a atividade...')
  carregarDashboard()
}

selectPeriodo.addEventListener('change', carregarDashboard)
btnAtualizar.addEventListener('click', carregarDashboard)
document.addEventListener('atendimento-salvo', () => {
  if (!document.getElementById('aba-dashboard').classList.contains('escondido')) {
    carregarDashboard()
  }
})

btnExportarCSV.addEventListener('click',  () => exportarCSV(registrosAtuais))
btnExportarXLSX.addEventListener('click', () => exportarXLSX(registrosAtuais))

document.getElementById('edit-cancelar').addEventListener('click', () => {
  modalEdicao.classList.add('escondido')
})

formEdicao.addEventListener('submit', async ev => {
  ev.preventDefault()
  const processo   = editProcesso.value
  const atividade  = editAtividade.value
  const inicioDate = new Date(`${editData.value}T${editHoraInicio.value}:00`)
  const fimDate    = new Date(`${editData.value}T${editHoraFim.value}:00`)
  if (!processo || !atividade || fimDate <= inicioDate) return

  const btn = formEdicao.querySelector('button[type="submit"]')
  btn.disabled = true
  try {
    await atualizarAtendimento(idEmEdicao, {
      processo,
      atividade,
      obs: editObs.value.trim(),
      inicioDate,
      fimDate
    })
    modalEdicao.classList.add('escondido')
    carregarDashboard()
  } finally {
    btn.disabled = false
  }
})

// ── Limites de período ───────────────────────────────────────────────────────

function calcularLimites(periodo) {
  const agora = new Date()
  let inicio
  switch (periodo) {
    case 'hoje':
      inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
      break
    case 'semana': {
      const dow    = agora.getDay()
      const offset = dow === 0 ? 6 : dow - 1
      inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - offset)
      break
    }
    case 'mes':
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
      break
    case 'ano':
      inicio = new Date(agora.getFullYear(), 0, 1)
      break
    default:
      inicio = null
  }
  return { inicio, fim: agora }
}

// ── Carregamento principal ───────────────────────────────────────────────────

async function carregarDashboard() {
  const periodo = selectPeriodo.value

  // Atualiza título do gráfico de volume dinamicamente
  const titulosVolume = {
    hoje:   'Evolução do volume por hora (06h–18h)',
    semana: 'Evolução do volume por dia da semana',
    mes:    'Evolução do volume por dia do mês',
    ano:    'Evolução do volume por mês',
    todo:   'Evolução do volume (histórico completo)',
  }
  const tituloEl = document.getElementById('chart-volume-titulo')
  if (tituloEl) tituloEl.textContent = titulosVolume[periodo] ?? 'Evolução do volume'

  const { inicio } = calcularLimites(periodo)

  let q
  if (inicio) {
    q = query(
      collection(db, 'atendimentos'),
      where('inicio', '>=', Timestamp.fromDate(inicio)),
      orderBy('inicio', 'desc')
    )
  } else {
    q = query(collection(db, 'atendimentos'), orderBy('inicio', 'desc'))
  }

  const snap = await getDocs(q)
  const registros = []
  snap.forEach(d => {
    const dados = d.data()
    if (dados.status !== 'concluido') return
    registros.push({
      id: d.id,
      ...dados,
      inicio: dados.inicio?.toDate ? dados.inicio.toDate() : new Date(),
      fim:    dados.fim?.toDate    ? dados.fim.toDate()    : null
    })
  })

  registrosAtuais = registros
  atualizarCards(registros)
  atualizarGraficoVolume(registros, periodo)
  atualizarGraficoTMA(registros, periodo)
  atualizarGraficoHoras(registros, periodo)
  atualizarGraficoProcesso(registros)
  atualizarGraficoRanking(registros)
  atualizarTabela(registros)
}

// ── Cards de KPI ─────────────────────────────────────────────────────────────

function atualizarCards(registros) {
  const semPausa = registros.filter(r => !r.isPausa)
  const volume   = semPausa.length

  const somaDuracaoAtendimento = semPausa.reduce((a, r) => a + (r.duracaoSegundos || 0), 0)
  const somaDuracaoTotal       = registros.reduce((a, r) => a + (r.duracaoSegundos || 0), 0)
  const tmaSegundos = volume > 0 ? Math.round(somaDuracaoAtendimento / volume) : 0

  cardVolume.textContent = volume.toLocaleString('pt-BR')
  cardTMA.textContent    = formatarDuracaoLegivel(tmaSegundos)
  cardHoras.textContent  =
    (somaDuracaoTotal / 3600).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'h'
}

function formatarDuracaoLegivel(segundos) {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

// ── Helper de agrupamento temporal ───────────────────────────────────────────
// Compartilhado pelos 3 gráficos de série (Volume, TMA, Horas).
// Retorna { rotulos: string[], grupos: Array<Array<registro>> }

function agruparPorPeriodo(atendimentos, periodo) {
  const agora = new Date()

  if (periodo === 'hoje') {
    const total   = HORA_FIM_OPERACAO - HORA_INICIO_OPERACAO
    const rotulos = Array.from({ length: total }, (_, i) =>
      `${String(HORA_INICIO_OPERACAO + i).padStart(2, '0')}h`
    )
    const grupos = rotulos.map(() => [])
    atendimentos.forEach(r => {
      const h = r.inicio.getHours()
      if (h >= HORA_INICIO_OPERACAO && h < HORA_FIM_OPERACAO)
        grupos[h - HORA_INICIO_OPERACAO].push(r)
    })
    return { rotulos, grupos }
  }

  if (periodo === 'semana') {
    const rotulos = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    const grupos  = rotulos.map(() => [])
    atendimentos.forEach(r => {
      const dow = r.inicio.getDay()
      grupos[dow === 0 ? 6 : dow - 1].push(r)
    })
    return { rotulos, grupos }
  }

  if (periodo === 'mes') {
    const diasNoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate()
    const rotulos   = Array.from({ length: diasNoMes }, (_, i) => String(i + 1))
    const grupos    = rotulos.map(() => [])
    atendimentos.forEach(r => {
      const d = r.inicio.getDate() - 1
      if (d >= 0 && d < diasNoMes) grupos[d].push(r)
    })
    return { rotulos, grupos }
  }

  if (periodo === 'ano') {
    const rotulos = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    const grupos  = rotulos.map(() => [])
    atendimentos.forEach(r => grupos[r.inicio.getMonth()].push(r))
    return { rotulos, grupos }
  }

  // todo: agrupa por mês/ano cronológico
  const mapa = new Map()
  atendimentos.forEach(r => {
    const chave = `${String(r.inicio.getMonth() + 1).padStart(2, '0')}/${r.inicio.getFullYear()}`
    if (!mapa.has(chave)) mapa.set(chave, [])
    mapa.get(chave).push(r)
  })
  const entradas = [...mapa.entries()].sort((a, b) => {
    const [ma, ya] = a[0].split('/').map(Number)
    const [mb, yb] = b[0].split('/').map(Number)
    return ya !== yb ? ya - yb : ma - mb
  })
  return {
    rotulos: entradas.map(([k]) => k),
    grupos:  entradas.map(([, v]) => v),
  }
}

// ── Gráfico 1: Volume de atendimentos ────────────────────────────────────────

function atualizarGraficoVolume(registros, periodo) {
  const atendimentos = registros.filter(r => !r.isPausa)
  const { rotulos, grupos } = agruparPorPeriodo(atendimentos, periodo)
  const dados = grupos.map(g => g.length)

  if (chartVolume) chartVolume.destroy()
  chartVolume = new Chart(document.getElementById('chart-volume'), {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: [{
        label: 'Atendimentos',
        data: dados,
        backgroundColor: PALETA.verde,
        borderRadius: 4,
        maxBarThickness: 48,
      }],
    },
    options: opcoesBaseGrafico({}),
  })
}

// ── Gráfico 2: Evolução do TMA ───────────────────────────────────────────────

function atualizarGraficoTMA(registros, periodo) {
  const atendimentos = registros.filter(r => !r.isPausa)
  const { rotulos, grupos } = agruparPorPeriodo(atendimentos, periodo)

  // TMA em minutos (null = balde vazio → linha não conecta pontos)
  const dados = grupos.map(g => {
    if (!g.length) return null
    const soma = g.reduce((a, r) => a + (r.duracaoSegundos || 0), 0)
    return Math.round(soma / g.length / 60 * 10) / 10
  })

  if (chartTMA) chartTMA.destroy()
  chartTMA = new Chart(document.getElementById('chart-tma-evolucao'), {
    type: 'line',
    data: {
      labels: rotulos,
      datasets: [{
        label: 'TMA (min)',
        data: dados,
        borderColor: PALETA.amarelo,
        backgroundColor: 'rgba(236, 177, 31, 0.10)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: PALETA.amarelo,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        spanGaps: true,
      }],
    },
    options: opcoesBaseGrafico({ tickFormatY: v => `${v}m` }),
  })
}

// ── Gráfico 3: Horas trabalhadas ─────────────────────────────────────────────

function atualizarGraficoHoras(registros, periodo) {
  // Inclui pausas no total (representa o tempo logado em sistema)
  const { rotulos, grupos } = agruparPorPeriodo(registros, periodo)
  const dados = grupos.map(g =>
    Math.round(g.reduce((a, r) => a + (r.duracaoSegundos || 0), 0) / 360) / 10
  )

  if (chartHoras) chartHoras.destroy()
  chartHoras = new Chart(document.getElementById('chart-horas-evolucao'), {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: [{
        label: 'Horas',
        data: dados,
        backgroundColor: PALETA.verdeClaro,
        borderRadius: 4,
        maxBarThickness: 48,
      }],
    },
    options: opcoesBaseGrafico({ tickFormatY: v => `${v}h` }),
  })
}

// ── Gráfico 4: Distribuição por processo (Doughnut) ──────────────────────────

function atualizarGraficoProcesso(registros) {
  const contagem = new Map()
  registros.forEach(r => {
    const chave = r.processo || 'Não informado'
    contagem.set(chave, (contagem.get(chave) || 0) + 1)
  })

  const rotulos = [...contagem.keys()]
  const valores = [...contagem.values()]
  const cores   = gerarPaletaDerivada(rotulos.length)

  if (chartProcesso) chartProcesso.destroy()
  chartProcesso = new Chart(document.getElementById('chart-processo'), {
    type: 'doughnut',
    data: {
      labels: rotulos,
      datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: PALETA.textoPrimario, boxWidth: 12, font: { family: 'Inter' } }
        }
      }
    }
  })
}

// ── Gráfico 5: Ranking por operador (barras horizontais) ─────────────────────

function atualizarGraficoRanking(registros) {
  const contagem = new Map()
  registros
    .filter(r => !r.isPausa)
    .forEach(r => {
      const chave = r.nomeOperador || 'Não informado'
      contagem.set(chave, (contagem.get(chave) || 0) + 1)
    })

  const ordenado = [...contagem.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  const rotulos  = ordenado.map(([nome]) => nome)
  const valores  = ordenado.map(([, qtd]) => qtd)

  if (chartRanking) chartRanking.destroy()
  chartRanking = new Chart(document.getElementById('chart-ranking'), {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: [{
        label: 'Atendimentos',
        data: valores,
        backgroundColor: PALETA.amarelo,
        borderRadius: 4
      }]
    },
    options: { ...opcoesBaseGrafico({}), indexAxis: 'y' }
  })
}

// ── Opções base dos gráficos ─────────────────────────────────────────────────

function opcoesBaseGrafico({ legenda = false, tickFormatY } = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: legenda } },
    scales: {
      x: {
        grid: { color: PALETA.borda },
        ticks: { color: PALETA.textoSecundario, font: { family: 'Inter' } }
      },
      y: {
        beginAtZero: true,
        grid: { color: PALETA.borda },
        ticks: {
          color: PALETA.textoSecundario,
          font: { family: 'Inter' },
          precision: 0,
          ...(tickFormatY ? { callback: tickFormatY } : {}),
        }
      }
    }
  }
}

function gerarPaletaDerivada(qtd) {
  const base = [
    PALETA.verde, PALETA.amarelo, PALETA.verdeClaro, PALETA.verdeEscuro,
    PALETA.perigo, '#7FB8B5', '#D9941A', '#3E5C5A'
  ]
  const cores = []
  for (let i = 0; i < qtd; i++) cores.push(base[i % base.length])
  return cores
}

// ── Tabela de histórico ──────────────────────────────────────────────────────

function atualizarTabela(registros) {
  corpoTabela.innerHTML = ''
  tabelaVazia.classList.toggle('escondido', registros.length > 0)

  for (const r of registros) {
    const tr = document.createElement('tr')
    const editavel = podeEditar(r)

    tr.innerHTML = `
      <td>${r.inicio.toLocaleDateString('pt-BR')}</td>
      <td>${r.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${r.fim ? r.fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '–'}</td>
      <td>${formatarDuracaoLegivel(r.duracaoSegundos || 0)}</td>
      <td>${escaparHTML(r.nomeOperador || '')}</td>
      <td>${escaparHTML(r.processo || '')}</td>
      <td>${escaparHTML(r.atividade || '')}</td>
      <td>${r.isPausa ? '<span class="selo selo-pausa">Pausa</span>' : ''}</td>
      <td class="celula-obs">${escaparHTML(r.obs || '')}</td>
      <td class="celula-acoes"></td>
    `

    const celulaAcoes = tr.querySelector('.celula-acoes')
    if (editavel) {
      const btnEditar = document.createElement('button')
      btnEditar.className = 'botao-icone'
      btnEditar.title     = 'Editar'
      btnEditar.textContent = 'Editar'
      btnEditar.addEventListener('click', () => abrirEdicao(r))

      const btnExcluir = document.createElement('button')
      btnExcluir.className  = 'botao-icone botao-icone-perigo'
      btnExcluir.title      = 'Excluir'
      btnExcluir.textContent = 'Excluir'
      btnExcluir.addEventListener('click', () => confirmarExclusao(r.id))

      celulaAcoes.appendChild(btnEditar)
      celulaAcoes.appendChild(btnExcluir)
    } else {
      celulaAcoes.innerHTML =
        '<span class="texto-bloqueado" title="Somente a liderança pode alterar registros de dias anteriores">Bloqueado</span>'
    }

    corpoTabela.appendChild(tr)
  }
}

function abrirEdicao(registro) {
  idEmEdicao          = registro.id
  editProcesso.value  = registro.processo  || ''
  editAtividade.value = registro.atividade || ''
  editData.value      = registro.inicio.toISOString().slice(0, 10)
  editHoraInicio.value = `${String(registro.inicio.getHours()).padStart(2,'0')}:${String(registro.inicio.getMinutes()).padStart(2,'0')}`
  editHoraFim.value   = registro.fim
    ? `${String(registro.fim.getHours()).padStart(2,'0')}:${String(registro.fim.getMinutes()).padStart(2,'0')}`
    : ''
  editObs.value = registro.obs || ''
  modalEdicao.classList.remove('escondido')
}

async function confirmarExclusao(id) {
  if (!window.confirm('Excluir este registro? Esta ação não pode ser desfeita.')) return
  await excluirAtendimento(id)
  carregarDashboard()
}

function escaparHTML(texto) {
  const div = document.createElement('div')
  div.textContent = texto
  return div.innerHTML
}
