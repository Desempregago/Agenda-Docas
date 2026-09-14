import { useEffect, useRef } from 'react';

/**
 * Bloqueia o scroll do fundo (body) enquanto o overlay estiver aberto.
 *
 * Estratégia "position: fixed" no <body>, que funciona também no iOS:
 * guarda a posição Y atual, congela o body e a restaura (sem salto) ao fechar.
 * Isso impede o scroll da página atrás de modais e do drawer mobile.
 *
 * Uso: `useBodyScrollLock(isOpen);` dentro do componente do overlay.
 */
export function useBodyScrollLock(active: boolean): void {
  const savedY = useRef(0);

  useEffect(() => {
    if (!active) return;

    const { body } = document;
    const { scrollY } = window;

    savedY.current = scrollY;
    body.style.position = 'fixed';
    body.style.top = `${-scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = '';
      body.style.top = '';
      body.style.left = '';
      body.style.right = '';
      body.style.width = '';
      body.style.overflow = '';
      window.scrollTo(0, savedY.current);
    };
  }, [active]);
}
