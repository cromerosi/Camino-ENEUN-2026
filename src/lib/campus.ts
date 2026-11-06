/**
 * Normalización de nombres de sede. Es código puro (sin dependencias de
 * servidor) para poder usarse tanto en las APIs como en el panel admin.
 */

export function normalizeCampusName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function isSameCampus(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeCampusName(a);
  return left !== '' && left === normalizeCampusName(b);
}

/**
 * Devuelve la lista de sedes sin duplicados (comparando de forma normalizada),
 * conservando la primera forma escrita de cada una.
 */
export function uniqueCampuses(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = normalizeCampusName(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push((value ?? '').trim());
  }

  return result;
}
