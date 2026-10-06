// Permissoes do detalhe da OS com os padroes historicos (liberado, exceto o que e sensivel).
export function buildDetailPermissions(permissions = {}) {
  const changeStatus = permissions.changeStatus ?? true;
  return {
    edit: permissions.edit ?? true,
    changeStatus,
    finish: permissions.finish ?? changeStatus,
    attendance: permissions.attendance ?? true,
    print: permissions.print ?? true,
    reopen: permissions.reopen ?? false,
    runScripts: permissions.runScripts ?? false,
    registerSimulation: permissions.registerSimulation ?? false,
    schedule: permissions.schedule ?? true
  };
}
