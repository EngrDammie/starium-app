// Presentational tab: department + action role definitions.
export default function RolesTab({
  config, newDeptRole, setNewDeptRole, saveDeptRole, deleteDeptRole,
  newActionRole, setNewActionRole, saveActionRole, deleteActionRole,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-[fadeIn_0.3s]">
      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-2">🏢 Department Access Roles</h2>
        <p className="text-sm text-gray-400 mb-6">These roles define which Pages and Menus a user can see.</p>

        <form onSubmit={saveDeptRole} className="flex flex-col gap-3 mb-6 bg-[#1a1a1a] p-4 rounded-lg border border-[#444]">
          <input type="text" placeholder="Category (e.g., Human Resources)" required value={newDeptRole.category} onChange={e=>setNewDeptRole({...newDeptRole, category: e.target.value})} className="w-full bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>

          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="ID (e.g., hr_staff)" required value={newDeptRole.id} onChange={e=>setNewDeptRole({...newDeptRole, id: e.target.value.toLowerCase().replace(/\s+/g, '_')})} className="flex-1 bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>
            <input type="text" placeholder="Label (e.g., HR Staff)" required value={newDeptRole.label} onChange={e=>setNewDeptRole({...newDeptRole, label: e.target.value})} className="flex-1 bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>
          </div>

          <button type="submit" className="w-full bg-primary text-black font-bold px-4 py-3 mt-1 rounded hover:bg-primary-dark transition-all">➕ Add Department Role</button>
        </form>

        <div className="space-y-4">
          {Object.entries((config.departmentRoles || []).reduce((acc, r) => {
            if (!acc[r.category]) acc[r.category] = [];
            acc[r.category].push(r);
            return acc;
          }, {})).map(([category, roles]) => (
            <div key={category}>
              <h4 className="text-status-warning text-xs uppercase font-bold tracking-wider mb-2 border-b border-[#333] pb-1">{category}</h4>
              <ul className="space-y-2">
                {roles.map(r => (
                  <li key={r.id} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded border border-[#333]">
                    <div><span className="font-bold text-white mr-3">{r.label}</span><span className="text-xs text-gray-500 font-mono">{r.id}</span></div>
                    <button onClick={() => deleteDeptRole(r.id)} className="text-status-danger hover:text-red-400 px-2 text-xl">&times;</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-dark-card p-6 rounded-xl border border-[#333] shadow-lg">
        <h2 className="text-xl font-bold text-primary mb-2">⚡ Action Approval Roles</h2>
        <p className="text-sm text-gray-400 mb-6">These roles define which specific Buttons a user can click.</p>

        <form onSubmit={saveActionRole} className="flex flex-col gap-3 mb-6 bg-[#1a1a1a] p-4 rounded-lg border border-[#444]">
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="ID (e.g., forklift_op)" required value={newActionRole.id} onChange={e=>setNewActionRole({...newActionRole, id: e.target.value.toLowerCase().replace(/\s+/g, '_')})} className="flex-1 bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>
            <input type="text" placeholder="Label (e.g., 🚜 Forklift)" required value={newActionRole.label} onChange={e=>setNewActionRole({...newActionRole, label: e.target.value})} className="flex-1 bg-[#121212] text-white border border-[#444] p-3 rounded outline-none focus:border-primary text-sm"/>
          </div>
          <button type="submit" className="w-full bg-primary text-black font-bold px-4 py-3 mt-1 rounded hover:bg-primary-dark transition-all">⚡ Add Action Role</button>
        </form>

        <ul className="space-y-2">
          {(config.actionRoles || []).map(r => (
            <li key={r.id} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded border border-[#333]">
              <div><span className="font-bold text-white mr-3">{r.label}</span><span className="text-xs text-gray-500 font-mono">{r.id}</span></div>
              <button onClick={() => deleteActionRole(r.id)} className="text-status-danger hover:text-red-400 px-2 text-xl">&times;</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
