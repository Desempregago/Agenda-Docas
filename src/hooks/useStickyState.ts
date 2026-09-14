import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Estado persistente por aba (sessionStorage).
 *
 * Igual ao useState, mas o valor sobrevive a desmontagens do componente
 * (ex.: trocar de aba Agendamentos/Rastreamento/Docas) e até a recarregar
 * a página — dentro da mesma aba do navegador. Ao fechar a aba, limpa.
 *
 * Uso: `const [filtro, setFiltro] = useStickyState('chave', valorPadrao);`
 */
export function useStickyState<T extends string>(
  key: string,
  fallback: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw === null ? fallback : (raw as T);
    } catch (_) {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (_) {
      /* storage indisponível (modo privado etc.) — comporta-se como useState comum */
    }
  }, [key, value]);

  return [value, setValue];
}
