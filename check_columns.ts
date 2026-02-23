import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkSchema() {
    const tables = ['confessions', 'dykm_scores', 'xp_transactions', 'hot_seat_questions', 'tod_messages']

    for (const table of tables) {
        console.log(`Checking table: ${table}`)
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1)

        if (error) {
            console.error(`Error checking ${table}:`, error.message)
        } else if (data && data.length > 0) {
            console.log(`Columns for ${table}:`, Object.keys(data[0]))
        } else {
            console.log(`No data in ${table}, but table exists. Trying to get column names via empty select...`)
            // If no data, we can't easily get columns this way without a more complex query or RPC
        }
    }
}

checkSchema()
