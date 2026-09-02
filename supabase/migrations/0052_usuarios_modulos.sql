-- A tela de "Usuários e Permissões" (Configurações) já salvava a lista de
-- módulos liberados por usuário no código, mas a coluna nunca existia no
-- banco — o UPDATE falhava em silêncio e caía num fallback sem "modulos",
-- então nenhuma alteração de permissão feita por um admin chegava de
-- verdade ao dispositivo do usuário afetado (só ficava salva localmente no
-- navegador de quem editou). Esta migration cria a coluna que faltava.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos text[] NOT NULL DEFAULT '{}';
