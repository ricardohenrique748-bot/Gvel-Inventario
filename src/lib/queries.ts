export const VEICULO_COM_RELACOES = '*, marca:marcas(*), modelo:modelos(*), cliente:clientes(*)'
export const MOVIMENTACAO_COM_VEICULO = `*, veiculo:veiculos(${VEICULO_COM_RELACOES}), patio:patios(*), status_manutencao:status_manutencao(*)`
