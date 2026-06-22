// manual.js
// Formulário de lançamento manual (inserção de dados retroativos).

import { PROCESSOS, ATIVIDADES } from './constants.js'
import { popularSelects } from './timer.js'
import { criarLancamentoManual } from './records.js'

const form = document.getElementById('form-manual')
const selectProcesso = document.getElementById('manual-processo')
const selectAtividade = document.getElementById('manual-atividade')
const inputData = document.getElementById('manual-data')
const inputHoraInicio = document.getElementById('manual-hora-inicio')
const inputHoraFim = document.getElementById('manual-hora-fim')
const inputObs = document.getElementById('manual-obs')
const mensagem = document.getElementById('manual-mensagem')

export function inicializarManual() {
  popularSelects(selectProcesso, PROCESSOS, 'Selecione o processo...')
  popularSelects(selectAtividade, ATIVIDADES, 'Selecione a atividade...')
  const hoje = new Date()
  inputData.value = hoje.toISOString().slice(0, 10)
}

form.addEventListener('submit', async ev => {
  ev.preventDefault()
  mensagem.classList.add('escondido')

  const processo = selectProcesso.value
  const atividade = selectAtividade.value
  const data = inputData.value
  const horaInicio = inputHoraInicio.value
  const horaFim = inputHoraFim.value
  const obs = inputObs.value.trim()

  if (!processo || !atividade || !data || !horaInicio || !horaFim) return

  const inicioDate = new Date(`${data}T${horaInicio}:00`)
  const fimDate = new Date(`${data}T${horaFim}:00`)

  if (fimDate <= inicioDate) {
    mostrarMensagem(
      'A hora de término deve ser depois da hora de início.',
      true
    )
    return
  }

  const btn = form.querySelector('button[type="submit"]')
  btn.disabled = true
  btn.textContent = 'Salvando...'

  try {
    await criarLancamentoManual({
      processo,
      atividade,
      obs,
      inicioDate,
      fimDate
    })
    form.reset()
    inicializarManual()
    mostrarMensagem('Lançamento registrado com sucesso.', false)
  } catch (err) {
    mostrarMensagem('Não foi possível salvar. Tente novamente.', true)
  } finally {
    btn.disabled = false
    btn.textContent = 'Registrar lançamento'
  }
})

function mostrarMensagem(texto, erro) {
  mensagem.textContent = texto
  mensagem.classList.remove('escondido')
  mensagem.classList.toggle('mensagem-erro', erro)
  mensagem.classList.toggle('mensagem-sucesso', !erro)
}
