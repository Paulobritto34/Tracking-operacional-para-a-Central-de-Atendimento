// dashboard.js
// Visão executiva: filtro de período, cards de KPI, 3 gráficos (Chart.js),
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

const selectPeriodo = document.getElementById('dash-periodo')
const btnAtualizar = document.getElementById('dash-atualizar')
const cardVolume = document.getElementById('card-volume')
const cardTMA = document.getElementById('card-tma')
const cardHoras = document.getElementById('card-horas')
const corpoTabela = document.getElementById('tabela-historico-corpo')
const tabelaVazia = document.getElementById('tabela-historico-vazia')
const btnExportarCSV = document.getElementById('btn-exportar-csv')
const btnExportarXLSX = document.getElementById('btn-exportar-xlsx')

const modalEdicao = document.getElementById('modal-edicao')
const formEdicao = document.getElementById('form-edicao')
const editProcesso = document.getElementById('edit-processo')
const editAtividade = document.getElementById('edit-atividade')
const editData = document.getElementById('edit-data')
const editHoraInicio = document.getElementById('edit-hora-inicio')
const editHoraFim = document.getElementById('edit-hora-fim')
const editObs = document.getElementById('edit-obs')
let idEmEdicao = null

let chartVolume = null
let chartProcesso = null
let chartRanking = null

let registrosAtuais = []

export function inicializarDashboard() {
  popularSelects(editProcesso, PROCESSOS, 'Selecione o processo...')
  popularSelects(editAtividade, ATIVIDADES, 'Selecione a atividade...')
  carregarDashboard()
}

selectPeriodo.addEventListener('change', carregarDashboard)
btnAtualizar.addEventListener('click', carregarDashboard)
document.addEventListener('atendimento-salvo', () => {
  if (
    !document.getElementById('aba-dashboard').classList.contains('escondido')
  ) {
    carregarDashboard()
  }
})

btnExportarCSV.addEventListener('click', () => exportarCSV(registrosAtuais))
btnExportarXLSX.addEventListener('click', () => exportarXLSX(registrosAtuais))

document.getElementById('edit-cancelar').addEventListener('click', () => {
  modalEdicao.classList.add('escondido')
})

formEdicao.addEventListener('submit', async ev => {
  ev.preventDefault()
  const processo = editProcesso.value
  const atividade = editAtividade.value
  const inicioDate = new Date(`${editData.value}T${editHoraInicio.value}:00`)
  const fimDate = new Date(`${editData.value}T${editHoraFim.value}:00`)
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

function calcularLimites(periodo) {
  const agora = new Date()
  let inicio
  switch (periodo) {
    case 'hoje':
      inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
      break
    case 'semana': {
      const diaSemana = agora.getDay() // 0 = domingo
      const offset = diaSemana === 0 ? 6 : diaSemana - 1 // segunda-feira como início
      inicio = new Date(
        agora.getFullYear(),
        agora.getMonth(),
        agora.getDate() - offset
      )
      break
    }
    case 'mes':
      inicio = new Date(agora.getFullYear(), agora.getMonth(), 1)
      break
    case 'ano':
      inicio = new Date(agora.getFullYear(), 0, 1)
      break
    default:
      inicio = null // todo o período
  }
  return { inicio, fim: agora }
}

async function carregarDashboard() {
  const periodo = selectPeriodo.value
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
    if (dados.status !== 'concluido') return // ignora em andamento/cancelados
    registros.push({
      id: d.id,
      ...dados,
      inicio: dados.inicio?.toDate ? dados.inicio.toDate() : new Date(),
      fim: dados.fim?.toDate ? dados.fim.toDate() : null
    })
  })

  registrosAtuais = registros
  atualizarCards(registros)
  atualizarGraficoVolume(registros)
  atualizarGraficoProcesso(registros)
  atualizarGraficoRanking(registros)
  atualizarTabela(registros)
}

function atualizarCards(registros) {
  const semPausa = registros.filter(r => !r.isPausa)
  const volume = semPausa.length
  const somaDuracaoAtendimento = semPausa.reduce(
    (acc, r) => acc + (r.duracaoSegundos || 0),
    0
  )
  const somaDuracaoTotal = registros.reduce(
    (acc, r) => acc + (r.duracaoSegundos || 0),
    0
  )
  const tmaSegundos =
    volume > 0 ? Math.round(somaDuracaoAtendimento / volume) : 0

  cardVolume.textContent = volume.toLocaleString('pt-BR')
  cardTMA.textContent = formatarDuracaoLegivel(tmaSegundos)
  cardHoras.textContent =
    (somaDuracaoTotal / 3600).toLocaleString('pt-BR', {
      maximumFractionDigits: 1
    }) + 'h'
}

function formatarDuracaoLegivel(segundos) {
  const h = Math.floor(segundos / 3600)
  const m = Math.floor((segundos % 3600) / 60)
  const s = segundos % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

function atualizarGraficoVolume(registros) {
  const totalHoras = HORA_FIM_OPERACAO - HORA_INICIO_OPERACAO
  const contagemPorHora = new Array(totalHoras).fill(0)

  registros
    .filter(r => !r.isPausa)
    .forEach(r => {
      const hora = r.inicio.getHours()
      if (hora >= HORA_INICIO_OPERACAO && hora < HORA_FIM_OPERACAO) {
        contagemPorHora[hora - HORA_INICIO_OPERACAO] += 1
      }
    })

  const rotulos = contagemPorHora.map(
    (_, i) => `${String(HORA_INICIO_OPERACAO + i).padStart(2, '0')}h`
  )

  if (chartVolume) chartVolume.destroy()
  chartVolume = new Chart(document.getElementById('chart-volume'), {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: [
        {
          label: 'Atendimentos',
          data: contagemPorHora,
          backgroundColor: PALETA.verde,
          borderRadius: 4,
          maxBarThickness: 36
        }
      ]
    },
    options: opcoesBaseGrafico({ legenda: false })
  })
}

function atualizarGraficoProcesso(registros) {
  const contagem = new Map()
  registros.forEach(r => {
    const chave = r.processo || 'Não informado'
    contagem.set(chave, (contagem.get(chave) || 0) + 1)
  })

  const rotulos = [...contagem.keys()]
  const valores = [...contagem.values()]
  const cores = gerarPaletaDerivada(rotulos.length)

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
          labels: {
            color: PALETA.textoPrimario,
            boxWidth: 12,
            font: { family: 'Inter' }
          }
        }
      }
    }
  })
}

function atualizarGraficoRanking(registros) {
  const contagem = new Map()
  registros
    .filter(r => !r.isPausa)
    .forEach(r => {
      const chave = r.nomeOperador || 'Não informado'
      contagem.set(chave, (contagem.get(chave) || 0) + 1)
    })

  const ordenado = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
  const rotulos = ordenado.map(([nome]) => nome)
  const valores = ordenado.map(([, qtd]) => qtd)

  if (chartRanking) chartRanking.destroy()
  chartRanking = new Chart(document.getElementById('chart-ranking'), {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: [
        {
          label: 'Atendimentos',
          data: valores,
          backgroundColor: PALETA.amarelo,
          borderRadius: 4
        }
      ]
    },
    options: {
      ...opcoesBaseGrafico({ legenda: false }),
      indexAxis: 'y'
    }
  })
}

function opcoesBaseGrafico({ legenda }) {
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
          precision: 0
        }
      }
    }
  }
}

function gerarPaletaDerivada(qtd) {
  const base = [
    PALETA.verde,
    PALETA.amarelo,
    PALETA.verdeClaro,
    PALETA.verdeEscuro,
    PALETA.perigo,
    '#7FB8B5',
    '#D9941A',
    '#3E5C5A'
  ]
  const cores = []
  for (let i = 0; i < qtd; i++) cores.push(base[i % base.length])
  return cores
}

function atualizarTabela(registros) {
  corpoTabela.innerHTML = ''
  tabelaVazia.classList.toggle('escondido', registros.length > 0)

  for (const r of registros) {
    const tr = document.createElement('tr')
    const editavel = podeEditar(r)

    tr.innerHTML = `
      <td>${r.inicio.toLocaleDateString('pt-BR')}</td>
      <td>${r.inicio.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${r.fim ? r.fim.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
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
      btnEditar.title = 'Editar'
      btnEditar.textContent = 'Editar'
      btnEditar.addEventListener('click', () => abrirEdicao(r))

      const btnExcluir = document.createElement('button')
      btnExcluir.className = 'botao-icone botao-icone-perigo'
      btnExcluir.title = 'Excluir'
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
  idEmEdicao = registro.id
  editProcesso.value = registro.processo || ''
  editAtividade.value = registro.atividade || ''
  editData.value = registro.inicio.toISOString().slice(0, 10)
  editHoraInicio.value = `${String(registro.inicio.getHours()).padStart(2, '0')}:${String(registro.inicio.getMinutes()).padStart(2, '0')}`
  editHoraFim.value = registro.fim
    ? `${String(registro.fim.getHours()).padStart(2, '0')}:${String(registro.fim.getMinutes()).padStart(2, '0')}`
    : ''
  editObs.value = registro.obs || ''
  modalEdicao.classList.remove('escondido')
}

async function confirmarExclusao(id) {
  if (
    !window.confirm('Excluir este registro? Esta ação não pode ser desfeita.')
  )
    return
  await excluirAtendimento(id)
  carregarDashboard()
}

function escaparHTML(texto) {
  const div = document.createElement('div')
  div.textContent = texto
  return div.innerHTML
}
