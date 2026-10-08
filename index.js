function render(){
  // ... (mantenha o código inicial dos gráficos até a criação de c2) ...

  // 1. Salva a seleção atual do filtro para não perder se a tela re-renderizar
  const valAtual = $('#fs').value;

  // 2. Define os status padrão desejados + status encontrados no arquivo
  const listaPadrao = ['Em andamento', 'Entregue', 'Cancelado', 'Suspenso'];
  const todasSituacoes = [...new Set([...listaPadrao, ...sts.map(([s]) => s)])];

  // 3. Preenche o select com todas as opções
  $('#fs').innerHTML = '<option value="">Todas as situações</option>' + 
    todasSituacoes.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');

  // 4. Restaura o valor selecionado
  $('#fs').value = valAtual;

  list();
 }