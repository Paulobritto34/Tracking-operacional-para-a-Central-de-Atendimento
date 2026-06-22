// app.js
// Ponto de entrada: liga a navegação por abas e inicializa os módulos
// (cronômetro, manual, dashboard) depois que o login é confirmado.

import { aoLogar } from './auth.js'
import { inicializarCronometro } from './timer.js'
import { inicializarManual } from './manual.js'
import { inicializarDashboard } from './dashboard.js'

const botoesAba = document.querySelectorAll('.botao-aba')
const paineis = document.querySelectorAll('.aba-painel')

botoesAba.forEach(botao => {
  botao.addEventListener('click', () => {
    const destino = botao.dataset.aba
    botoesAba.forEach(b => b.classList.toggle('ativo', b === botao))
    paineis.forEach(p =>
      p.classList.toggle('escondido', p.id !== `aba-${destino}`)
    )
    if (destino === 'dashboard') inicializarDashboard()
  })
})

let inicializado = false
aoLogar(() => {
  if (inicializado) return
  inicializado = true
  inicializarCronometro()
  inicializarManual()
  inicializarDashboard()
})
