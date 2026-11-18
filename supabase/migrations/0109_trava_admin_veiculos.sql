-- Travas de administrador em veículos e movimentações.
--
-- 1. Só administrador exclui veículo (placa) e movimentação.
-- 2. Situação operante/inoperante de um veículo já cadastrado só muda por
--    administrador. Quando outro usuário tenta mudar (inclusive sem querer,
--    ex.: "Novo veículo" com placa que já existe), o banco mantém a situação
--    anterior e registra a tentativa como "bloqueado".
-- 3. Toda mudança (feita ou bloqueada) fica em veiculos_situacao_historico,
--    com quem tentou e quando.
--
-- Cadastro de veículo NOVO continua livre para escolher a situação inicial.
-- Conexões sem usuário logado (service role / manutenção pelo CLI) contam
-- como administrador.

create or replace function public.usuario_eh_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is null
    or lower(coalesce(auth.jwt() ->> 'email', '')) in ('ricardo_h.16@hotmail.com', 'victor@gveldiesel.com')
    or exists (
      select 1 from usuarios u
      where u.id = auth.uid() and (u.nivel = 'admin' or coalesce(u.is_master_admin, false))
    );
$$;

-- ── Exclusão só por admin ───────────────────────────────────────────────
-- RESTRICTIVE: soma (AND) com o isolamento por empresa que já existe.
drop policy if exists veiculos_delete_somente_admin on veiculos;
create policy veiculos_delete_somente_admin on veiculos
  as restrictive
  for delete
  using (public.usuario_eh_admin());

drop policy if exists movimentacoes_delete_somente_admin on movimentacoes;
create policy movimentacoes_delete_somente_admin on movimentacoes
  as restrictive
  for delete
  using (public.usuario_eh_admin());

-- ── Histórico de situação ───────────────────────────────────────────────
create table if not exists veiculos_situacao_historico (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid references veiculos(id) on delete set null,
  placa text,
  company_id uuid,
  de_operante boolean,
  para_operante boolean,
  resultado text not null check (resultado in ('alterado', 'bloqueado')),
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz not null default now()
);

create index if not exists veiculos_situacao_historico_veiculo_idx
  on veiculos_situacao_historico (veiculo_id, created_at desc);

alter table veiculos_situacao_historico enable row level security;

drop policy if exists veiculos_situacao_historico_select on veiculos_situacao_historico;
create policy veiculos_situacao_historico_select on veiculos_situacao_historico
  for select
  using (company_id = current_company_id());
-- Sem policy de insert/update/delete: só o trigger (security definer) grava.

create or replace function public.trava_situacao_veiculo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_admin boolean := public.usuario_eh_admin();
begin
  if new.operante is not distinct from old.operante then
    return new;
  end if;

  select nome into v_nome from usuarios where id = auth.uid();

  insert into veiculos_situacao_historico
    (veiculo_id, placa, company_id, de_operante, para_operante, resultado, usuario_id, usuario_nome)
  values
    (new.id, new.placa, new.company_id, old.operante, new.operante,
     case when v_admin then 'alterado' else 'bloqueado' end,
     auth.uid(), coalesce(v_nome, case when auth.uid() is null then 'SISTEMA' else null end));

  if not v_admin then
    new.operante := old.operante;
  end if;

  return new;
end;
$$;

drop trigger if exists trava_situacao_veiculo on veiculos;
create trigger trava_situacao_veiculo
  before update of operante on veiculos
  for each row
  execute function public.trava_situacao_veiculo();
