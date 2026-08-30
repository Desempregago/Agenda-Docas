/**
 * Formatters and validators for Brazilian logistics and tax documentation
 */

/**
 * Formata CPF: 000.000.000-00
 */
export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/**
 * Formata CNPJ: 00.000.000/0000-00
 */
export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
}

/**
 * Formata moeda BRL: R$ 1.234,56
 */
export function formatCurrencyBRL(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(Number(value))) return 'R$ 0,00';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converte string digitada para número monetário
 */
export function parseCurrencyInput(value: string): number {
  if (!value) return 0;
  // Se contiver vírgula ou ponto, limpar e converter
  const clean = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Formata chave de acesso de NF-e (44 dígitos) em grupos de 4 para melhor legibilidade
 * Ex: 3526 0800 0000 0000 0000 5500 1000 0000 0110 0000 0000
 */
export function formatNfeAccessKey(key: string): string {
  const digits = key.replace(/\D/g, '').slice(0, 44);
  if (!digits) return '';
  return digits.match(/.{1,4}/g)?.join(' ') || digits;
}

/**
 * Limpa chave de acesso de NF-e mantendo apenas os dígitos (máximo 44)
 */
export function cleanNfeAccessKey(key: string): string {
  return key.replace(/\D/g, '').slice(0, 44);
}

/**
 * Extrai múltiplas chaves de NF-e a partir de um texto bruto (várias linhas, separados por vírgula, espaços, etc.)
 */
export function extractNfeKeysFromText(text: string): string[] {
  if (!text || typeof text !== 'string') return [];
  
  // Primeiro tenta extrair blocos exatos de 44 dígitos
  const rawDigitsOnly = text.replace(/\D/g, '');
  if (rawDigitsOnly.length >= 88 && rawDigitsOnly.length % 44 === 0) {
    const chunked: string[] = [];
    for (let i = 0; i < rawDigitsOnly.length; i += 44) {
      chunked.push(rawDigitsOnly.slice(i, i + 44));
    }
    return chunked;
  }

  // Divide por quebras de linha, vírgula ou ponto-e-vírgula
  const parts = text.split(/[\n\r,;]+/).map(p => p.trim()).filter(Boolean);
  const keys: string[] = [];

  for (const part of parts) {
    const cleaned = cleanNfeAccessKey(part);
    if (cleaned.length > 0) {
      keys.push(cleaned);
    }
  }

  return keys.length > 0 ? keys : [cleanNfeAccessKey(text)];
}
