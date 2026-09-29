export async function processDueRecurring(supabase, householdId) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: due } = await supabase
    .from('recurring_transactions')
    .select('*')
    .eq('household_id', householdId)
    .eq('active', true)
    .lte('next_date', today)
    .gte('end_date', today)

  for (const r of due || []) {
    if (r.split_config?.splits?.length > 0) {
      const rows = r.split_config.splits.map(s => ({
        household_id: r.household_id,
        user_id: s.user_id,
        created_by: r.created_by,
        description: r.description,
        amount: s.amount,
        category_id: r.category_id,
        type: r.type,
        date: r.next_date,
      }))
      await supabase.from('transactions').insert(rows)
    } else {
      await supabase.from('transactions').insert({
        household_id: r.household_id,
        user_id: r.created_by,
        created_by: r.created_by,
        description: r.description,
        amount: r.amount,
        category_id: r.category_id,
        type: r.type,
        date: r.next_date,
      })
    }
    const next = computeNextDate(r)
    await supabase.from('recurring_transactions').update({ next_date: next }).eq('id', r.id)
  }
}

function computeNextDate(r) {
  const d = new Date(r.next_date)
  if (r.frequency === 'weekly')  d.setDate(d.getDate() + 7)
  if (r.frequency === 'monthly') d.setMonth(d.getMonth() + 1)
  if (r.frequency === 'custom')  d.setDate(d.getDate() + (r.interval_days || 1))
  return d.toISOString().slice(0, 10)
}
