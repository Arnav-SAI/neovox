import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dwdyndcpgmiibraxyrri.supabase.co'
const supabaseKey = 'sb_publishable_Ymy1Prd3sTRJE-VX_T1a5A_vyvJHYVD'

export const supabase = createClient(supabaseUrl, supabaseKey)