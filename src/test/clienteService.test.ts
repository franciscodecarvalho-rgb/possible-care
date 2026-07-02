import { describe, it, expect } from "vitest";
import { validarDocumento } from "@/lib/clienteService";

describe("validarDocumento — CPF com dígito verificador", () => {
  it("aceita CPF válido (com e sem máscara)", () => {
    expect(validarDocumento("529.982.247-25", "pf")).toBe(true);
    expect(validarDocumento("52998224725", "pf")).toBe(true);
  });
  it("rejeita CPF com dígito verificador errado", () => {
    expect(validarDocumento("52998224724", "pf")).toBe(false);
  });
  it("rejeita sequências repetidas que passariam no cálculo", () => {
    expect(validarDocumento("11111111111", "pf")).toBe(false);
    expect(validarDocumento("00000000000", "pf")).toBe(false);
  });
  it("rejeita comprimento errado", () => {
    expect(validarDocumento("1234567890", "pf")).toBe(false);
  });
});

describe("validarDocumento — CNPJ com dígito verificador", () => {
  it("aceita CNPJ válido (com e sem máscara)", () => {
    expect(validarDocumento("11.222.333/0001-81", "pj")).toBe(true);
    expect(validarDocumento("11222333000181", "pj")).toBe(true);
  });
  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(validarDocumento("11222333000182", "pj")).toBe(false);
  });
  it("rejeita sequências repetidas", () => {
    expect(validarDocumento("11111111111111", "pj")).toBe(false);
  });
});
