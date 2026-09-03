const ENTITY_MAP = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
}

function decodeXml(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
      if (entity[0] === "#") {
        const hexadecimal = entity[1]?.toLowerCase() === "x";
        return String.fromCodePoint(Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10));
      }
      return ENTITY_MAP[entity.toLowerCase()] || "";
    })
    .trim();
}

function tag(block, name) {
  return decodeXml(block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] || "");
}

function inferCategory(name) {
  const value = name.toLowerCase();
  if (/mem[oó]ria|\bram\b|ddr[3-6]/.test(value)) return "Memória";
  if (/ssd|hd |hdd|nvme|armazen/.test(value)) return "Armazenamento";
  if (/processador|\bcpu\b|ryzen|core i[3579]/.test(value)) return "Processador";
  if (/placa.m[aã]e|motherboard/.test(value)) return "Placa-mãe";
  if (/placa de v[ií]deo|gpu|geforce|radeon/.test(value)) return "Vídeo";
  if (/rede|switch|roteador|adapter|wifi|ethernet|cabo/.test(value)) return "Rede";
  if (/fonte|nobreak|energia|bateria/.test(value)) return "Energia";
  if (/mouse|teclado|monitor|headset|impressora|webcam/.test(value)) return "Periféricos";
  return "Outros";
}

export function parseNfePurchaseXml(xmlInput) {
  const xml = Buffer.isBuffer(xmlInput) ? xmlInput.toString("utf8") : String(xmlInput || "");
  if (!/<(?:nfeProc|NFe|infNFe)\b/i.test(xml) || !/<det\b/i.test(xml)) invalid("O arquivo não contém uma NF-e de produtos válida.");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) invalid("NF-e rejeitada por conter declarações XML não permitidas.");

  const emit = xml.match(/<emit\b[^>]*>([\s\S]*?)<\/emit>/i)?.[1] || "";
  const infNfeId = xml.match(/<infNFe\b[^>]*\bId=["']NFe([^"']+)["']/i)?.[1] || "";
  const invoiceKey = tag(xml, "chNFe") || infNfeId || null;
  const supplierName = tag(emit, "xNome") || "Fornecedor não identificado";
  const supplierTaxId = tag(emit, "CNPJ") || tag(emit, "CPF") || null;
  const items = [];
  const detailPattern = /<det\b[^>]*>([\s\S]*?)<\/det>/gi;
  for (const match of xml.matchAll(detailPattern)) {
    if (items.length >= 500) break;
    const product = match[1].match(/<prod\b[^>]*>([\s\S]*?)<\/prod>/i)?.[1] || "";
    const name = tag(product, "xProd");
    if (!name) continue;
    const parsedQuantity = Number(String(tag(product, "qCom") || "1").replace(",", "."));
    const parsedUnitPrice = Number(String(tag(product, "vUnCom") || "0").replace(",", "."));
    items.push({
      supplierProductCode: tag(product, "cProd") || null,
      name: name.slice(0, 240),
      category: inferCategory(name),
      quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
      unitPrice: Number.isFinite(parsedUnitPrice) && parsedUnitPrice >= 0 ? parsedUnitPrice : 0,
      unit: tag(product, "uCom") || "un",
      manufacturerPartNumber: tag(product, "cEAN") || null,
      ncm: tag(product, "NCM") || null
    });
  }
  if (!items.length) invalid("Nenhum produto foi encontrado na NF-e.");
  return { invoiceKey, supplierName, supplierTaxId, items };
}
