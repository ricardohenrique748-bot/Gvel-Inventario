-- Multi-empresa (Fase 1) — isolamento de arquivos nos buckets de fotos.
--
-- Hoje qualquer usuário autenticado lê/escreve em qualquer objeto dos
-- buckets 'fotos-inspecao' e 'assinaturas'. A partir de agora, uma empresa
-- só acessa objetos cujo primeiro segmento do caminho seja o seu próprio
-- company_id (novo padrão, ver src/lib/tenant.ts). A GVEL mantém acesso
-- total (inclusive aos objetos antigos, sem prefixo, que já existem hoje),
-- sem precisar mover nenhum arquivo.

drop policy if exists "authenticated_read_fotos" on storage.objects;
drop policy if exists "authenticated_write_fotos" on storage.objects;
drop policy if exists "authenticated_read_assinaturas" on storage.objects;
drop policy if exists "authenticated_write_assinaturas" on storage.objects;
drop policy if exists "empresa_fotos_assinaturas" on storage.objects;

create policy "empresa_fotos_assinaturas" on storage.objects for all
  using (
    bucket_id in ('fotos-inspecao', 'assinaturas')
    and auth.role() = 'authenticated'
    and (
      current_company_id() = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
      or is_master_admin_user()
      or (storage.foldername(name))[1] = current_company_id()::text
    )
  )
  with check (
    bucket_id in ('fotos-inspecao', 'assinaturas')
    and auth.role() = 'authenticated'
    and (
      current_company_id() = '0923c894-85ca-45c1-ba1b-3124d19b4d65'
      or is_master_admin_user()
      or (storage.foldername(name))[1] = current_company_id()::text
    )
  );
