import test from "node:test";
import assert from "node:assert/strict";
import { parseNfePurchaseXml } from "./partInventoryImport.js";

test("interpreta produtos e fornecedor de uma NF-e sem executar conteúdo XML", () => {
  const result = parseNfePurchaseXml(`<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe123"><emit><CNPJ>00112233000144</CNPJ><xNome>Fornecedor &amp; Cia</xNome></emit><det nItem="1"><prod><cProd>RAM-16</cProd><xProd>Memória RAM DDR4 16GB</xProd><NCM>84733042</NCM><uCom>UN</uCom><qCom>2.0000</qCom><vUnCom>185.50</vUnCom></prod></det></infNFe></NFe><protNFe><infProt><chNFe>123</chNFe></infProt></protNFe></nfeProc>`);
  assert.equal(result.invoiceKey, "123");
  assert.equal(result.supplierName, "Fornecedor & Cia");
  assert.equal(result.items[0].category, "Memória");
  assert.equal(result.items[0].quantity, 2);
});

test("rejeita XML com DTD ou sem produtos de NF-e", () => {
  assert.throws(() => parseNfePurchaseXml("<!DOCTYPE foo><NFe><det /></NFe>"), /não permitidas/i);
  assert.throws(() => parseNfePurchaseXml("<xml />"), /NF-e/i);
});
