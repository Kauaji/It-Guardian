/**
 * Sem precedente no projeto (nenhum outro lugar baixa um arquivo pelo
 * cliente) - Blob + createObjectURL + <a> temporario e o jeito padrao de
 * disparar o download sem navegar a pagina para longe do estado atual.
 */
export function triggerCsvDownload(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
