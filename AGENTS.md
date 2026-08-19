# Guia de trabajo - What If Wealth

Reglas para cualquier agente que escriba codigo en este proyecto. Complementan el
`CLAUDE.md` global; donde haya conflicto, manda este archivo.

## 1. Ciclo de trabajo obligatorio

**Nunca commitear un cambio que el usuario no probo.**

Cada cambio sigue este ciclo, sin saltear pasos:

1. Implementar el cambio.
2. Dejar la app en estado ejecutable (`yarn dev` levanta sin errores).
3. Avisar al usuario que puede probar, indicando **que** probar y **como**: la ruta, el
   input a usar, y el resultado esperado.
4. Esperar la confirmacion del usuario.
5. Recien ahi commitear.

Si el usuario reporta un problema, se corrige y se vuelve al paso 2. El commit va cuando el
usuario dice que funciona, no cuando el agente cree que funciona.

No agrupar varias fases del `plan.md` en un solo commit. Una fase, una prueba, un commit.

### Como pedir la prueba

Concreto y accionable, no generico:

```
Listo la fase 1. Para probar:
1. yarn dev y abrir http://localhost:3000
2. Arrastrar portfolio.csv al dropzone
3. Deberias ver 140 lotes, 4 simbolos (SPYG, VXUS, BTC-USD, SMH) y
   9 lotes marcados como costo cero
```

Nada de "probalo y me decis".

## 2. Idioma

Esta es una **excepcion deliberada** al `CLAUDE.md` global, que prohibe comentar en espanol.
En este proyecto es al reves:

| Elemento                              | Idioma  |
| ------------------------------------- | ------- |
| Comentarios de codigo                 | Espanol |
| JSDoc                                 | Espanol |
| Variables, funciones, tipos, archivos | Ingles  |
| Strings de UI                         | Ingles  |
| Mensajes de commit                    | Ingles  |
| Documentacion (`.md`)                 | Espanol |

Los comentarios en espanol son **cortos y concisos**. Una linea, al grano, explicando el
porque y no el que. Si un comentario necesita mas de tres lineas, o el codigo esta mal
factorizado o merece un bloque JSDoc.

```typescript
/**
 * Normaliza la cantidad de un lote a terminos post-split, usando el factor
 * implicito entre el cierre crudo y el ajustado de su fecha de compra.
 *
 * @param {Lot} lot El lote a normalizar.
 * @param {PriceBar} bar La barra correspondiente a la fecha del lote.
 *
 * @returns {number} La cantidad ajustada por splits.
 */
function toAdjustedQuantity(lot: Lot, bar: PriceBar): number {
  // El factor incorpora splits y dividendos reinvertidos.
  const factor = bar.adjClose / bar.close;
  return lot.quantity / factor;
}
```

Comentar el porque, no el que:

```typescript
// Mal: incrementa el contador
counter++;

// Bien: BTC cotiza los 7 dias, los ETFs no, hay que unir calendarios.
const timeline = mergeCalendars(histories);
```

## 3. Estilo de codigo

Heredado del `CLAUDE.md` global.

- Sin llaves cuando el cuerpo es de una sola linea.

  ```typescript
  if (!history?.bars?.length)
    throw new Error(`No price history available for ${ticker}.`);
  ```

- Separar el codigo en secciones con lineas en blanco, segun el contexto del proceso. Cada
  seccion arranca con su comentario en espanol.
- Legibilidad por encima de todo. Nada de `Object.assign` ni trucos de `prototype` salvo que
  no exista otra forma de expresar el concepto.
- Prettier al guardar. Correr el formateo antes de commitear.
- Si una interfaz ya tiene JSDoc en sus metodos, la clase que la implementa no los repite.

## 4. Convenciones del proyecto

- **Package manager**: `yarn`, siempre. Nunca `npm` ni `pnpm`.
- **Aislamiento de proveedor**: toda llamada a `yahoo-finance2` vive en `lib/market/yahoo.ts`.
  Ningun componente ni el motor importan la libreria directo.
- **Motor puro**: `lib/portfolio/engine.ts` no hace fetch, no importa React y no toca
  `localStorage`. Recibe datos, devuelve datos. Todo lo que sea calculo va ahi y tiene test.
- **Un solo resolvedor de fechas**: nunca buscar una barra por igualdad exacta de fecha fuera
  de `resolveBar` y `lastBarAsOf`.
- **Nunca leer las columnas de cotizacion del CSV** (`Current Price`, `Open`, `High`, `Low`,
  `Volume`, `Change`). Estan desactualizadas. El precio actual se pide a la API.

## 5. Commits

Estilo Angular, en ingles, titulo solo. Descripcion unicamente si el cambio es grande y tiene
divergencias de contexto.

```
feat: yahoo portfolio csv import with per-row validation
fix: correct quantity parsing for scientific notation
chore: refactor market cache into its own module
refactor: extract date resolver from engine
```

Sin co-autoria. Los commits van a nombre del usuario.

## 6. Antes de dar algo por terminado

- `yarn dev` levanta sin errores ni warnings nuevos.
- `yarn test` en verde si la fase toco el motor.
- Prettier corrido.
- El usuario probo y confirmo.
- Los comentarios nuevos estan en espanol y el codigo en ingles.

Si algo de esto no se cumple, decirlo explicitamente en vez de dar el trabajo por cerrado.
