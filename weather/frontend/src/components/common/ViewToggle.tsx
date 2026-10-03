/** "Table view" toggle shared by chart cards (UX §5). */
export function ViewToggle({ table, onChange }: { table: boolean; onChange: (table: boolean) => void }) {
  return (
    <button type="button" className="btn btn--quiet view-toggle" aria-pressed={table} onClick={() => onChange(!table)}>
      {table ? 'Chart view' : 'Table view'}
    </button>
  );
}
