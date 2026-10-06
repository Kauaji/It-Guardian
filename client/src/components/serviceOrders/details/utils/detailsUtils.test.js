import { describe, expect, it, vi } from "vitest";
import { buildGroupOptions, filterAvailableBackups, filterDevicesForLink, filterSegmentsForLink } from "./assetLink.js";
import { describeProduct, filterProductSuggestions, filterServiceSuggestions, findProductByName, findServiceByName } from "./catalog.js";
import { appendPart, buildDraft, buildPartItem, buildPartLine, normalizeItems, sumItems } from "./items.js";
import { formatCurrency, getProductPrice, normalizeQuantity, parseCurrency } from "./money.js";
import { buildAvailableSectors, buildDeleteMessage, buildStatusLabelMap, buildStatusOptions, resolveSectorUpdate } from "./orderLookups.js";
import { buildDetailPermissions } from "./permissions.js";
import { buildPrintDocument } from "./printDocument.js";
import { escapeHtml, formatDate, normalizeSearchText } from "./text.js";

describe("money", () => {
  it("lê valores em formato brasileiro e americano e rejeita negativos", () => {
    expect(parseCurrency("R$ 1.234,56")).toBe(1234.56);
    expect(parseCurrency("1234.5")).toBe(1234.5);
    expect(parseCurrency("")).toBe(0);
    expect(parseCurrency(null)).toBe(0);
    expect(parseCurrency("-5")).toBe(0);
    expect(parseCurrency("abc")).toBe(0);
  });

  it("normaliza quantidade com vírgula e cai em 1 quando inválida", () => {
    expect(normalizeQuantity("2,5")).toBe(2.5);
    expect(normalizeQuantity(3)).toBe(3);
    expect(normalizeQuantity(0)).toBe(1);
    expect(normalizeQuantity(undefined)).toBe(1);
  });

  it("formata moeda e escolhe o primeiro preço disponível do produto", () => {
    expect(formatCurrency(10)).toBe("R$ 10,00");
    expect(formatCurrency(undefined)).toBe("R$ 0,00");
    expect(getProductPrice({ unitPrice: 5 })).toBe(5);
    expect(getProductPrice({ unit_price: "6,50" })).toBe(6.5);
    expect(getProductPrice({ price: 7 })).toBe(7);
    expect(getProductPrice({ salePrice: 8 })).toBe(8);
    expect(getProductPrice(null)).toBe(0);
  });
});

describe("text", () => {
  it("busca sem acento e sem caixa", () => {
    expect(normalizeSearchText("  Memória DDR4 ")).toBe("memoria ddr4");
    expect(normalizeSearchText()).toBe("");
    expect(normalizeSearchText(0)).toBe("0");
  });

  it("escapa HTML e trata nulos", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#039;&amp;&#039;&lt;/a&gt;");
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(0)).toBe("0");
  });

  it("formata data/hora ou 'Não informado'", () => {
    expect(formatDate("")).toBe("Não informado");
    expect(formatDate("2026-08-10T12:00:00.000Z")).toMatch(/10\/08\/2026/);
  });
});

describe("items", () => {
  it("normaliza itens de formatos antigos e descarta os sem nome", () => {
    vi.spyOn(Date, "now").mockReturnValue(1);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    expect(normalizeItems("x")).toEqual([]);
    expect(normalizeItems(undefined)).toEqual([]);
    const [first, second] = normalizeItems([
      { id: "a", product_id: "p", product_name: "Cabo", quantity: "2,5", unit_price: "R$ 4,00", notes: "n" },
      { name: "Fonte", quantity: 1, unitPrice: 10 },
      { id: "z" }
    ]);
    expect(first).toEqual({ id: "a", productId: "p", productName: "Cabo", quantity: 2.5, unitPrice: 4, subtotal: 10, notes: "n" });
    expect(second.id).toBe("1-8");
    expect(second.productName).toBe("Fonte");
    expect(sumItems([first, second])).toBe(20);
    vi.restoreAllMocks();
  });

  it("monta o rascunho com padrões e origem alternativa dos itens", () => {
    expect(buildDraft(null)).toMatchObject({ title: "", priority: "medium", autoPriorityEnabled: false, serviceValue: "0", items: [] });
    const draft = buildDraft({ title: "T", priority: "high", serviceValue: 12, serviceItems: [{ id: "i", productName: "P", quantity: 1, unitPrice: 2 }], autoPriorityEnabled: true });
    expect(draft).toMatchObject({ title: "T", priority: "high", serviceValue: "12", autoPriorityEnabled: true });
    expect(draft.items).toHaveLength(1);
  });

  it("constrói a linha, o item e acrescenta a peça ao rascunho", () => {
    expect(buildPartLine({ productName: "A", quantity: 1, unitPrice: 0, subtotal: 0 })).toBe("A x1");
    expect(buildPartLine({ productName: "A", quantity: 2, unitPrice: 5, subtotal: 10 })).toBe("A x2 - R$ 10,00");
    vi.spyOn(Date, "now").mockReturnValue(99);
    const item = buildPartItem({ product: { id: "p1", name: "SSD" }, manualProductName: "x", partDraft: { quantity: "2", unitPrice: "5" } });
    expect(item).toEqual({ id: "p1-99", productId: "p1", productName: "SSD", quantity: 2, unitPrice: 5, subtotal: 10, notes: "" });
    const manual = buildPartItem({ product: undefined, manualProductName: "Avulsa", partDraft: { quantity: 1, unitPrice: "0" } });
    expect(manual).toMatchObject({ id: "manual-99", productId: "", productName: "Avulsa" });
    const next = appendPart({ partsUsed: "antes", items: [] }, item);
    expect(next.partsUsed).toBe("antes\nSSD x2 - R$ 10,00");
    expect(next.items).toEqual([item]);
    expect(appendPart({ partsUsed: "", items: [] }, manual).partsUsed).toBe("Avulsa x1");
    vi.restoreAllMocks();
  });
});

describe("catalog", () => {
  const products = Array.from({ length: 9 }, (_, index) => ({ id: `p${index}`, name: `Peça ${index}`, category: index === 3 ? "Memória" : "Geral" }));
  const services = [{ id: "s1", name: "Formatação", category: "Software" }, { id: "s2", name: "Troca" }];

  it("filtra por termo sem acento e limita a sete sugestões", () => {
    expect(filterProductSuggestions(products, "")).toHaveLength(7);
    expect(filterProductSuggestions(products, "memoria").map((product) => product.id)).toEqual(["p3"]);
    expect(filterServiceSuggestions(services, "FORMATACAO")).toHaveLength(1);
    expect(filterServiceSuggestions(services, "")).toHaveLength(2);
  });

  it("encontra por nome normalizado e descreve o produto", () => {
    expect(findProductByName(products, "peça 4")?.id).toBe("p4");
    expect(findProductByName(products, "nada")).toBeUndefined();
    expect(findServiceByName(services, "troca")?.id).toBe("s2");
    expect(describeProduct({ category: "A", brand: "B", model: "C" })).toBe("A - B - C");
    expect(describeProduct({ name: "x" })).toBe("");
  });
});

describe("assetLink", () => {
  const segments = [
    { id: "s1", tabId: "t1", groupId: "g1" },
    { id: "s2", tabId: "t1" },
    { id: "s3", tabId: "t1", isDefault: true },
    { id: "s4", tabId: "t2", group: { id: "g9" }, groupName: "Nome do segmento" },
    { id: "s5", tabId: "t2", groupId: "g2", groupName: "Do segmento" }
  ];
  const groups = [{ id: "g1", name: "Andar 1" }];

  it("lista grupos ordenados, com 'Sem grupo' e nomes alternativos", () => {
    expect(buildGroupOptions(segments, groups, "t1")).toEqual([{ id: "g1", name: "Andar 1" }, { id: "ungrouped", name: "Sem grupo" }]);
    expect(buildGroupOptions(segments, groups, "t2")).toEqual([{ id: "g2", name: "Do segmento" }, { id: "g9", name: "Nome do segmento" }]);
    expect(buildGroupOptions([{ id: "x", tabId: "t", groupId: "gx", groupName: "Via segmento" }], [], "")).toEqual([{ id: "gx", name: "Via segmento" }]);
  });

  it("filtra segmentos por aba e grupo", () => {
    expect(filterSegmentsForLink(segments, { tabId: "t1", groupId: "" }).map((segment) => segment.id)).toEqual(["s1", "s2"]);
    expect(filterSegmentsForLink(segments, { tabId: "t1", groupId: "ungrouped" }).map((segment) => segment.id)).toEqual(["s2"]);
    expect(filterSegmentsForLink(segments, { tabId: "", groupId: "g9" }).map((segment) => segment.id)).toEqual(["s4"]);
  });

  it("filtra máquinas por aba, segmento, grupo e busca", () => {
    const devices = [
      { id: "d1", name: "PC Um", ip: "10.0.0.1", tabId: "t1", segmentId: "s1" },
      { id: "d2", name: "PC Dois", tabId: "t9", isGlobalUnorganized: true, segmentId: "s2" },
      { id: "d3", name: "Outro", tabId: "t2", segmentId: "s4", groupId: "g9" }
    ];
    const run = (draft) => filterDevicesForLink(devices, segments, { tabId: "", groupId: "", segmentId: "", search: "", ...draft }).map((device) => device.id);
    expect(run({})).toEqual(["d1", "d2", "d3"]);
    expect(run({ tabId: "t1" })).toEqual(["d1", "d2"]);
    expect(run({ segmentId: "s2" })).toEqual(["d2"]);
    expect(run({ groupId: "g1" })).toEqual(["d1"]);
    expect(run({ groupId: "ungrouped" })).toEqual(["d2"]);
    expect(run({ groupId: "g9" })).toEqual(["d3"]);
    expect(run({ search: "10.0.0.1" })).toEqual(["d1"]);
  });

  it("separa backups livres", () => {
    const devices = [
      { id: "b1", isBackup: true },
      { id: "b2", isBackup: true, backupStatus: "in_use" },
      { id: "b3", isBackup: true },
      { id: "m", isBackup: true },
      { id: "x" }
    ];
    expect(filterAvailableBackups(devices, { assetId: "m", backupAssetId: "b3" }).map((device) => device.id)).toEqual(["b1"]);
    expect(filterAvailableBackups(devices, null)).toHaveLength(3);
  });
});

describe("orderLookups e permissões", () => {
  it("monta rótulos de situação a partir dos status configurados ou do padrão", () => {
    expect(buildStatusOptions([])).toHaveLength(4);
    const configured = [{ id: "x", name: "Extra" }];
    expect(buildStatusOptions(configured)).toBe(configured);
    expect(buildStatusLabelMap(configured)).toMatchObject({ open: "Aberta", x: "Extra" });
  });

  it("lista setores ativos com o Geral sempre presente", () => {
    expect(buildAvailableSectors([{ id: "a", name: "A" }, { id: "b", name: "B", active: false }, null, { name: "sem id" }]).map((sector) => sector.id)).toEqual(["sector-geral", "a"]);
    expect(buildAvailableSectors([{ id: "sector-geral", name: "Outro" }])[0].name).toBe("Outro");
  });

  it("resolve o setor, caindo no Geral", () => {
    const sectors = buildAvailableSectors([{ id: "a", name: "A" }]);
    expect(resolveSectorUpdate(sectors, "a")).toEqual({ sectorId: "a", sectorName: "A" });
    expect(resolveSectorUpdate(sectors, "zzz")).toEqual({ sectorId: "sector-geral", sectorName: "Geral" });
    expect(resolveSectorUpdate([], "zzz")).toEqual({ sectorId: "sector-geral", sectorName: "Geral" });
  });

  it("avisa na exclusão de OS ainda não finalizada", () => {
    expect(buildDeleteMessage({ closedAt: "x" })).not.toContain("ainda não foi finalizada");
    expect(buildDeleteMessage({})).toContain("ainda não foi finalizada");
  });

  it("aplica os padrões de permissão", () => {
    expect(buildDetailPermissions()).toEqual({ edit: true, changeStatus: true, finish: true, attendance: true, print: true, reopen: false, runScripts: false, registerSimulation: false, schedule: true });
    expect(buildDetailPermissions({ changeStatus: false }).finish).toBe(false);
    expect(buildDetailPermissions({ changeStatus: false, finish: true }).finish).toBe(true);
  });
});

describe("printDocument", () => {
  const base = {
    serviceOrder: { number: "OS-1", title: "T", status: "open", priority: "high", createdAt: "2026-08-10T12:00:00.000Z" },
    draft: {},
    asset: null,
    statusLabelMap: { open: "Aberta" },
    environmentLabel: "Ambiente",
    businessMode: false,
    serviceItems: [],
    serviceValueNumber: 0,
    partsTotal: 0,
    totalValue: 0
  };

  it("omite valores no modo Local sem itens", () => {
    const html = buildPrintDocument(base);
    expect(html).not.toContain("<h2>Valores</h2>");
    expect(html).toContain("Sem atendimento registrado.");
    expect(html).toContain("<span>Ambiente</span><strong>Não informado</strong>");
  });

  it("lista itens e totais, preferindo o rascunho ao valor salvo", () => {
    const html = buildPrintDocument({
      ...base,
      businessMode: true,
      serviceOrder: { ...base.serviceOrder, servicePerformed: "Antigo", diagnosis: "Salvo" },
      draft: { servicePerformed: "Novo" },
      serviceItems: [{ productName: "Cabo <x>", quantity: 2, unitPrice: 3, subtotal: 6 }],
      serviceValueNumber: 10,
      partsTotal: 6,
      totalValue: 16
    });
    expect(html).toContain("<h2>Valores</h2>");
    expect(html).toContain("<td>Cabo &lt;x&gt;</td>");
    expect(html).toContain("Serviço realizado: Novo\n\nDiagnóstico: Salvo");
    expect(html).toContain("<strong>R$&nbsp;16,00</strong>".replace("&nbsp;", " "));
  });
});
