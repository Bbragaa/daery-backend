/** Remove tudo que não for dígito (máscaras, espaços, pontuação). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function allSameDigit(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

/** Valida CPF pelos dígitos verificadores. Aceita com ou sem máscara. */
export function isValidCpf(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || allSameDigit(cpf)) return false;

  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(cpf.charAt(i)) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(cpf.charAt(9)) && digit(10) === Number(cpf.charAt(10));
}

/** Valida CNPJ pelos dígitos verificadores. Aceita com ou sem máscara. */
export function isValidCnpj(value: string): boolean {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || allSameDigit(cnpj)) return false;

  const digit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(cnpj.charAt(i)) * weights[i];
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return digit(12) === Number(cnpj.charAt(12)) && digit(13) === Number(cnpj.charAt(13));
}

/** "52998224725" → "***.982.247-**". Mantém só os dígitos centrais visíveis. */
export function maskCpf(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return null;
  return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}
