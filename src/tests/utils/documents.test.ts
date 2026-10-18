import { isValidCnpj, isValidCpf, maskCpf, onlyDigits } from "../../utils/documents";

describe("isValidCpf", () => {
  it("accepts a valid CPF with or without mask", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejects wrong check digits, wrong length and repeated digits", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("5299822472")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
});

describe("isValidCnpj", () => {
  it("accepts a valid CNPJ with or without mask", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("rejects wrong check digits and repeated digits", () => {
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
  });
});

describe("maskCpf", () => {
  it("keeps only the middle digits visible", () => {
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
  });

  it("returns null when there is no CPF", () => {
    expect(maskCpf(null)).toBeNull();
    expect(maskCpf(undefined)).toBeNull();
  });
});

describe("onlyDigits", () => {
  it("strips punctuation", () => {
    expect(onlyDigits("529.982.247-25")).toBe("52998224725");
  });
});
