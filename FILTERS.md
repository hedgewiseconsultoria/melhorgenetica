# Filtros e interpretação dos resultados

O endpoint `/api/recommend` consulta a base canônica real. Com `minAccuracy=0`, `maxTop=100`, `protect=false` e sem métricas obrigatórias, foram validados candidatos para todas as raças: Nelore, Guzerá, Brahman, Tabapuã e Sindi.

Filtros mais rigorosos podem retornar zero candidatos de forma legítima. Isso acontece quando uma raça não publica determinada métrica em uma tabela, quando o produtor exige várias métricas simultaneamente, quando a acurácia mínima é superior à disponível ou quando o TOP máximo é muito restritivo. A interface deve apresentar esse estado como ausência de candidatos compatíveis, nunca substituir por registros de outra raça ou por candidatos demonstrativos.

A regra de disponibilidade diferencia métrica não publicada de valor observado. O filtro `required` exige que o registro tenha ao menos um valor de DEP, AC ou TOP da métrica selecionada; valores observados iguais a zero continuam disponíveis.

## Validação automatizada

Execute o servidor com `PORT=4173 node server.mjs` e, em outro terminal, rode `TEST_PORT=4173 node scripts/test-recommendation.mjs`. O teste confirma resposta positiva, retorno não vazio e correspondência da raça para as cinco raças da base.
