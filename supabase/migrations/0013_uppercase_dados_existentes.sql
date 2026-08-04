-- Gvel Diesel — converte para maiúsculo os dados de texto já cadastrados
-- antes da regra de "tudo em caixa alta" existir. Cobre as mesmas colunas que
-- o app já envia em maiúsculo nos cadastros novos (ver src/lib/text.ts).
-- Rode este arquivo no SQL Editor do seu projeto Supabase (ou via `supabase db push`)
-- depois de já ter aplicado as migrations anteriores.

update clientes set nome = upper(nome) where nome <> upper(nome);
update clientes set endereco = upper(endereco) where endereco is not null and endereco <> upper(endereco);

update marcas set nome = upper(nome) where nome <> upper(nome);
update modelos set nome = upper(nome) where nome <> upper(nome);

update veiculos set cor = upper(cor) where cor is not null and cor <> upper(cor);
update veiculos set chassi = upper(chassi) where chassi is not null and chassi <> upper(chassi);

update patios set nome = upper(nome) where nome <> upper(nome);
update status_manutencao set nome = upper(nome) where nome <> upper(nome);

update movimentacoes set motorista = upper(motorista) where motorista is not null and motorista <> upper(motorista);
update movimentacoes set observacoes = upper(observacoes) where observacoes is not null and observacoes <> upper(observacoes);

update usuarios set nome = upper(nome) where nome <> upper(nome);

update inspecoes set inspetor = upper(inspetor) where inspetor <> upper(inspetor);
update inspecoes set responsavel_nome = upper(responsavel_nome) where responsavel_nome is not null and responsavel_nome <> upper(responsavel_nome);
update inspecoes set responsavel_cargo = upper(responsavel_cargo) where responsavel_cargo is not null and responsavel_cargo <> upper(responsavel_cargo);

update inspecao_itens set observacao = upper(observacao) where observacao is not null and observacao <> upper(observacao);
