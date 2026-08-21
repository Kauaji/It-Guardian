// Nome de um campo que nunca deve ser preenchido por uma pessoa real -
// mantido escondido via CSS (nao via display:none simples, que alguns
// leitores de bot ja ignoram) e checado no backend (mesmo nome em
// publicServiceOrderService.js). Ver honeypotFieldName no backend.
export const honeypotFieldName = "website";

export const urgencyOptions = [
  { value: "low", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" }
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Validacao client-side - so pra dar feedback rapido antes de enviar; o
// backend sempre revalida tudo de novo (nunca confia so nisso).
export function validatePublicSupportForm(form, { businessMode }) {
  if (form.title.trim().length < 3) {
    return "Informe um título com pelo menos 3 caracteres.";
  }
  if (form.description.trim().length < 5) {
    return "Descreva o problema com um pouco mais de detalhe.";
  }
  if (!form.category) {
    return "Selecione uma categoria.";
  }
  if (!form.problemType) {
    return "Selecione o tipo de problema.";
  }
  if (!form.requesterName.trim()) {
    return "Informe o nome do solicitante.";
  }
  if (businessMode && !form.contactInfo.trim()) {
    return "Informe um contato para abrir o chamado.";
  }
  if (
    businessMode &&
    (!form.environmentName.trim() || normalizeText(form.environmentName) === "nao identificado")
  ) {
    return "No modo Business, selecione um cliente para abrir a Ordem de Serviço.";
  }
  return "";
}
