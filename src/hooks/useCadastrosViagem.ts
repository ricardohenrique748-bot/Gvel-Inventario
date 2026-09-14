import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { up } from '@/lib/text'
import type { CentroCusto, Transportadora, TipoCarga, EnderecoFrequente, Pessoa, FormaPagamento, TipoLancamento, Fornecedor } from '@/lib/types'

// Cadastros de apoio do Controle de Viagens (Centro de Custo, Transportadora,
// Tipo de Carga) — todos simples (id + nome), no mesmo padrão de
// marcas/modelos, usados com <QuickCreateSelect> pra criar um novo direto no
// formulário de viagem sem precisar de uma tela de cadastro separada.

function useCadastroSimples<T extends { id: string; nome: string }>(tabela: string) {
  const [itens, setItens] = useState<T[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from(tabela).select('*').order('nome')
    setItens((data ?? []) as T[])
    setLoading(false)
  }, [tabela])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { itens, loading, refetch }
}

export function useCentrosCusto() {
  const { itens, loading, refetch } = useCadastroSimples<CentroCusto>('centros_custo')
  return { centrosCusto: itens, loading, refetch }
}

export function useTransportadoras() {
  const { itens, loading, refetch } = useCadastroSimples<Transportadora>('transportadoras')
  return { transportadoras: itens, loading, refetch }
}

export function useTiposCarga() {
  const { itens, loading, refetch } = useCadastroSimples<TipoCarga>('tipos_carga')
  return { tiposCarga: itens, loading, refetch }
}

export function usePessoas() {
  const { itens, loading, refetch } = useCadastroSimples<Pessoa>('pessoas')
  return { pessoas: itens, loading, refetch }
}

export function useFormasPagamento() {
  const { itens, loading, refetch } = useCadastroSimples<FormaPagamento>('formas_pagamento')
  return { formasPagamento: itens, loading, refetch }
}

export function useTiposLancamento() {
  const { itens, loading, refetch } = useCadastroSimples<TipoLancamento>('tipos_lancamento')
  return { tiposLancamento: itens, loading, refetch }
}

export function useFornecedores() {
  const { itens, loading, refetch } = useCadastroSimples<Fornecedor>('fornecedores')
  return { fornecedores: itens, loading, refetch }
}

// Fábrica de criar/atualizar/excluir pra cadastros simples (id + nome) —
// evita repetir a mesma tripla de funções pra cada tabela nova.
function fabricaCadastroSimples<T extends { id: string; nome: string }>(tabela: string) {
  return {
    criar: async (nome: string): Promise<T> => {
      const { data, error } = await supabase.from(tabela).insert({ nome: up(nome) }).select().single()
      if (error) throw error
      return data as T
    },
    atualizar: async (id: string, nome: string): Promise<T> => {
      const { data, error } = await supabase.from(tabela).update({ nome: up(nome) }).eq('id', id).select().single()
      if (error) throw error
      return data as T
    },
    excluir: async (id: string): Promise<void> => {
      const { error } = await supabase.from(tabela).delete().eq('id', id)
      if (error) throw error
    },
  }
}

const cadastroPessoas = fabricaCadastroSimples<Pessoa>('pessoas')
export const criarPessoa = cadastroPessoas.criar
export const atualizarPessoa = cadastroPessoas.atualizar
export const excluirPessoa = cadastroPessoas.excluir

const cadastroFormasPagamento = fabricaCadastroSimples<FormaPagamento>('formas_pagamento')
export const criarFormaPagamento = cadastroFormasPagamento.criar
export const atualizarFormaPagamento = cadastroFormasPagamento.atualizar
export const excluirFormaPagamento = cadastroFormasPagamento.excluir

const cadastroTiposLancamento = fabricaCadastroSimples<TipoLancamento>('tipos_lancamento')
export const criarTipoLancamento = cadastroTiposLancamento.criar
export const atualizarTipoLancamento = cadastroTiposLancamento.atualizar
export const excluirTipoLancamento = cadastroTiposLancamento.excluir

const cadastroFornecedores = fabricaCadastroSimples<Fornecedor>('fornecedores')
export const criarFornecedor = cadastroFornecedores.criar
export const atualizarFornecedor = cadastroFornecedores.atualizar
export const excluirFornecedor = cadastroFornecedores.excluir

export async function criarCentroCusto(nome: string): Promise<CentroCusto> {
  const { data, error } = await supabase.from('centros_custo').insert({ nome: up(nome) }).select().single()
  if (error) throw error
  return data as CentroCusto
}

export async function atualizarCentroCusto(id: string, nome: string): Promise<CentroCusto> {
  const { data, error } = await supabase.from('centros_custo').update({ nome: up(nome) }).eq('id', id).select().single()
  if (error) throw error
  return data as CentroCusto
}

export async function excluirCentroCusto(id: string): Promise<void> {
  const { error } = await supabase.from('centros_custo').delete().eq('id', id)
  if (error) throw error
}

export async function criarTransportadora(nome: string): Promise<Transportadora> {
  const { data, error } = await supabase.from('transportadoras').insert({ nome: up(nome) }).select().single()
  if (error) throw error
  return data as Transportadora
}

export async function criarTipoCarga(nome: string): Promise<TipoCarga> {
  const { data, error } = await supabase.from('tipos_carga').insert({ nome: up(nome) }).select().single()
  if (error) throw error
  return data as TipoCarga
}

export async function atualizarTipoCarga(id: string, nome: string): Promise<TipoCarga> {
  const { data, error } = await supabase.from('tipos_carga').update({ nome: up(nome) }).eq('id', id).select().single()
  if (error) throw error
  return data as TipoCarga
}

export async function excluirTipoCarga(id: string): Promise<void> {
  const { error } = await supabase.from('tipos_carga').delete().eq('id', id)
  if (error) throw error
}

// Endereços Frequentes têm mais campos que os cadastros acima (endereço,
// cidade, UF, além do apelido), então não usam o helper genérico.
export function useEnderecosFrequentes() {
  const [enderecos, setEnderecos] = useState<EnderecoFrequente[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('enderecos_frequentes').select('*').order('apelido')
    setEnderecos((data ?? []) as EnderecoFrequente[])
    setLoading(false)
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  return { enderecos, loading, refetch }
}

export async function criarEnderecoFrequente(input: {
  apelido: string
  endereco: string
  cidade: string
  uf: string
}): Promise<EnderecoFrequente> {
  const { data, error } = await supabase
    .from('enderecos_frequentes')
    .insert({
      apelido: up(input.apelido),
      endereco: up(input.endereco) || '',
      cidade: up(input.cidade) || '',
      uf: up(input.uf) || '',
    })
    .select()
    .single()
  if (error) throw error
  return data as EnderecoFrequente
}

export async function atualizarEnderecoFrequente(
  id: string,
  input: { apelido: string; endereco: string; cidade: string; uf: string },
): Promise<EnderecoFrequente> {
  const { data, error } = await supabase
    .from('enderecos_frequentes')
    .update({
      apelido: up(input.apelido),
      endereco: up(input.endereco) || '',
      cidade: up(input.cidade) || '',
      uf: up(input.uf) || '',
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as EnderecoFrequente
}

export async function excluirEnderecoFrequente(id: string): Promise<void> {
  const { error } = await supabase.from('enderecos_frequentes').delete().eq('id', id)
  if (error) throw error
}
