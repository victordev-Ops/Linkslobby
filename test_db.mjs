import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://gfdhowitmcrwggwzbgcx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmZGhvd2l0bWNyd2dnd3piZ2N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4MTE3NTcsImV4cCI6MjA3ODM4Nzc1N30.dV4GgfnMoG0GMyoqCV6M8R0WG6yba3BZCtPu5q1VX6s'
)

async function test() {
  const { data: insertData, error: insertError } = await supabase
    .from('rps_matches')
    .insert({ player_a: '00000000-0000-0000-0000-000000000000', mode: 'friend', status: 'waiting' })
    .select()
  
  if (insertError) {
    console.error('Insert error:', insertError)
    // Just try fetching one row again, maybe someone else created one
    const { data } = await supabase.from('rps_matches').select('*').limit(1)
    if (data && data.length > 0) console.log(Object.keys(data[0]))
    return
  }

  console.log('Columns:')
  console.log(Object.keys(insertData[0]))

  // Clean up
  await supabase.from('rps_matches').delete().eq('id', insertData[0].id)
}
test()
