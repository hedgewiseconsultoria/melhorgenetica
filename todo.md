# Project TODO

- [x] Preservar a ingestão das tabelas ANCP em arquivos separados por página e layout
- [x] Criar catálogo consultável com raça, página, tipo de tabela e rastreabilidade da fonte
- [x] Criar visão integrada canônica sem colunas duplicadas
- [x] Implementar indicadores de disponibilidade para diferenciar dado não publicado de valor observado
- [x] Integrar dados de teste reais extraídos do PDF ANCP 2026 sem inventar registros
- [x] Implementar perfis de melhoramento para cria, recria/engorda a pasto, confinamento e F1
- [x] Traduzir objetivos produtivos em métricas e critérios genéticos
- [x] Implementar barras ajustáveis para pesos de reprodução, desmama, crescimento e carcaça
- [x] Validar soma dos pesos configuráveis em 100%
- [x] Implementar filtros por raça e métricas disponíveis
- [x] Implementar filtro por acurácia mínima
- [x] Implementar filtro por faixa de TOP
- [x] Implementar limites de características a proteger
- [x] Implementar motor de pontuação explicável com normalização por raça/edição
- [x] Exibir classificação de candidatos, contribuições, alertas, trade-offs e página de origem
- [x] Construir jornada mobile-first de objetivo, prioridades, restrições e shortlist
- [x] Criar comparação clara entre candidatos
- [x] Aplicar marca Melhor Genética com azul-marinho monocromático e fundo branco
- [x] Criar emblema flat 2D com touro Nelore integrado a DNA e tipografia institucional
- [x] Configurar projeto Node.js + tRPC para execução local, GitHub e Render
- [x] Adicionar testes Vitest para validação de pesos, disponibilidade e pontuação
- [x] Validar visualmente desktop e mobile
- [x] Executar check, testes e build
- [ ] Criar checkpoint final antes de orientar publicação

## Histórico de correções

- [x] Corrigir qualquer duplicidade, desalinhamento ou coluna repetida encontrada na base ANCP
- [x] Não apresentar uma base consolidada como válida quando houver linhas incompletas ou layout não auditado

- [x] Adicionar UI genérica para múltiplas características protegidas
- [x] Testar distinção entre valor observado igual a zero e métrica não publicada
- [x] Testar efeito dos pesos, filtros e trade-offs no ranking

- [ ] Regenerar a visão canônica no próprio repositório a partir das tabelas auditadas
- [ ] Bloquear tabelas não auditadas ou linhas incompletas antes da recomendação
- [ ] Testar integridade da base efetivamente usada pela API
