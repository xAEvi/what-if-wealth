# What If Wealth

Visualizador de portafolio con simulación contrafactual. Importa el CSV de compras reales
exportado desde Yahoo Finance, valora el portafolio contra precios históricos de mercado y te
deja responder preguntas del tipo *"¿qué hubiera pasado si en vez de X hubiera comprado Y?"*.

## Qué hace

Una vez cargado tu portafolio, la aplicación te muestra:

- **Dashboard real**
  - Tarjetas de resumen: capital invertido, valor actual (cotización en vivo), ganancia y
    crecimiento porcentual.
  - Gráfica de valor total y de crecimiento a lo largo del tiempo.
  - Desglose por posición (valor, invertido, ganancia y crecimiento por ticker).
  - Toggle para **excluir lotes de costo cero** (activos recibidos gratis, no comprados).
- **Sustitución de ticker** (`What if… replace a ticker`)
  - Reemplaza un ticker de tu portafolio por otro, preservando el capital.
  - Autocompletado del ticker destino y validación de cobertura histórica: si el ticker no
    cotizaba antes de tu lote más viejo, la selección se bloquea para no inflar el crecimiento.
  - Opción para **reemplazar todos** los tickers por uno solo.
  - Gráfica comparativa con las dos series superpuestas.
- **Distribución por porcentajes** (`What if… distribute by weights`)
  - Reparte el capital entre varios tickers según los pesos que definas (deben sumar 100 %).
  - Verifica que el capital invertido total coincida con el del portafolio original.
  - Gráfica comparativa contra el portafolio real.

## Supuestos importantes

- **Reinversión de dividendos**: la valoración usa el precio ajustado (`adjClose`), por lo que
  asume que los dividendos se reinvierten. No es un estado de cuenta real.
- **Preservación del capital**: las simulaciones reasignan el capital invertido (no la cantidad
  de acciones), para que la comparación sea honesta entre tickers de distinto precio.
- **Moneda única**: todo se asume en USD.
- Los **lotes de costo cero** aportan valor de mercado pero no capital invertido; por eso
  distorsionan el crecimiento y se pueden excluir con el toggle.

## Cómo usar

1. Cloná el repo e instalá dependencias con `yarn install`.
2. Levantá la app: `yarn dev` y abrí http://localhost:3000.
3. Exportá tu portafolio desde Yahoo Finance (formato CSV) y arrastralo al dropzone.
   Si no tenés uno a mano, usá el botón **Download sample CSV** del estado vacío.
4. Explorá el dashboard y las simulaciones.

El CSV esperado es el export de Yahoo Finance (columnas `Symbol`, `Trade Date`,
`Purchase Price`, `Quantity`, `Transaction Type`, etc.). Solo se aceptan filas `BUY`; las filas
inválidas se descartan y se listan en una tabla de errores con su número de línea.

## Stack

| Capa | Elección |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Datos de mercado | `yahoo-finance2` en Route Handlers (proxy, con cache TTL) |
| Gráficas | `recharts` |
| CSV | `papaparse` |
| Estilos | Tailwind CSS |
| Estado | React Context + `useReducer` |
| Persistencia | `localStorage` |
| Package manager | `yarn` |

## Scripts

```bash
yarn dev      # servidor de desarrollo
yarn build    # build de producción
yarn start    # sirve el build de producción
yarn test     # tests unitarios del motor (vitest)
yarn lint     # eslint
yarn format   # prettier
```

> Nota: los scripts `dev` y `build` usan Turbopack (`--turbopack`) porque la ruta del proyecto
> contiene un `!`, que webpack reserva para su sintaxis de loaders.
