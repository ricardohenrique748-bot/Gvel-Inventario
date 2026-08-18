import { createClient } from '@supabase/supabase-js'

const url = 'https://njuncnhzkiajtcnemblx.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qdW5jbmh6a2lhanRjbmVtYmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NDI4MTQsImV4cCI6MjEwMTQxODgxNH0.tW3zSCLXlHf1UTpO-tFGUmcr4HGkVlkGlAXM6KaUk5A'

const supabase = createClient(url, key)

async function test() {
  const { data: movs } = await supabase.from('movimentacoes').select('id, veiculo:veiculos(placa)').limit(5)
  console.log('Movimentações:', movs)

  if (movs && movs.length > 0) {
    const movId = movs[0].id
    console.log('Testando insert no checklist_itens com movId:', movId)
    const { data: insData, error: insErr } = await supabase.from('checklist_itens').upsert({
      movimentacao_id: movId,
      item_id: 'test_item',
      secao_id: 'mecanica',
      label: 'TESTE',
      checked: true,
      hora_inicio: '09:00',
    }).select()
    console.log('Insert error:', insErr)
    console.log('Insert result:', insData)
  }
}

test()
