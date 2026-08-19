# What If Wealth - Plan de implementacion

Visualizador de portafolio con simulacion contrafactual. Se importa un CSV de compras
reales exportado desde Yahoo Finance, se valora contra precios historicos de mercado, y se
permite responder "que hubiera pasado si en vez de X hubiera comprado Y".

## 1. Stack

| Capa             | Eleccion                             | Motivo                                                                |
| ---------------- | ------------------------------------ | --------------------------------------------------------------------- |
| Framework        | Next.js 15 (App Router) + TypeScript | Front y backend en un solo deploy, sin servicio aparte                |
| Datos de mercado | `yahoo-finance2` en Route Handlers   | La API de Yahoo no permite CORS desde el browser, hay que hacer proxy |
| Graficas         | `recharts`                           | Composicion declarativa en React, suficiente para series temporales   |
| CSV              | `papaparse`                          | Parseo tolerante, deteccion de headers, errores por fila              |
| Estilos          | Tailwind CSS                         | Sin dependencia de sistema de diseno para el MVP                      |
| Estado           | React Context + `useReducer`         | El dominio es un solo objeto de portafolio, no amerita libreria       |
| Persistencia     | `localStorage`                       | El MVP no tiene usuarios ni backend con base de datos                 |
| Package manager  | `yarn`                               | Convencion del proyecto                                               |

Sin base de datos, sin autenticacion, sin ORM. Todo el calculo de simulacion corre en el
cliente una vez que el historico esta descargado.

### Decision de arquitectura clave

Las tres vistas (portafolio real, sustitucion de ticker, distribucion por porcentajes) NO
son tres motores de calculo. Son **un solo motor** que recibe tres listas distintas de
compras. Sustituir y distribuir son transformaciones que generan compras sinteticas a
partir de las reales, y despues se valoran con el mismo codigo.

```
CSV -> Lot[]  ---------------------------------\
                                                |
substituteTicker(Lot[], from, to) -------------->  buildSeries()  ->  PortfolioSeries
                                                |
distribute(Lot[], weights) --------------------/
```

Si esto se respeta, agregar una cuarta simulacion despues cuesta una funcion, no un modulo.

## 2. Formato del CSV de entrada

El archivo es un export de Yahoo Finance Portfolio con 17 columnas:

```
Symbol,Current Price,Date,Time,Change,Open,High,Low,Volume,Trade Date,Purchase Price,Quantity,Commission,High Limit,Low Limit,Comment,Transaction Type
SPYG,120.88,2026/08/19,13:04 UTC,0.31,120.5,121.2,120.1,1234567,20260818,120.88,8.17808,,,,,BUY
BTC-USD,64752.9,2026/08/19,13:04 UTC,594.72,64681.2,64917.8,64121.2,17806075904,20250307,0.0,9.0E-6,,,,Dual 2025-03-07,BUY
```

### Columnas que se usan

| Columna            | Uso                                                          |
| ------------------ | ------------------------------------------------------------ |
| `Symbol`           | Ticker, normalizado a mayusculas                             |
| `Trade Date`       | Fecha de compra, formato `YYYYMMDD` sin separadores          |
| `Purchase Price`   | Precio unitario pagado                                       |
| `Quantity`         | Cantidad, admite fracciones y notacion cientifica (`3.2E-5`) |
| `Transaction Type` | Solo se aceptan filas `BUY`                                  |

### Columnas que se ignoran a proposito

`Current Price`, `Date`, `Time`, `Change`, `Open`, `High`, `Low` y `Volume` son un snapshot
de cotizacion que Yahoo repite identico en cada fila del mismo simbolo. Esta desactualizado
al momento del export y nosotros pedimos el precio actual a la API. No leerlos nunca.

`Commission`, `High Limit` y `Low Limit` vienen vacios o en cero. `Comment` es texto libre
del usuario, se conserva solo para mostrar en la tabla de lotes.

### Parseo

- `Trade Date`: partir el string de 8 digitos en anio, mes y dia. No pasar `20240404` a
  `new Date()` directo, lo interpreta mal.
- `Quantity`: `parseFloat` maneja la notacion cientifica. Verificar que PapaParse con
  `dynamicTyping` no la rompa antes; si lo hace, parsear a mano.
- Validaciones por fila, reportando numero de linea: simbolo no vacio, fecha valida y no
  futura, cantidad mayor a cero, precio mayor o igual a cero.
- Filas invalidas se muestran en una tabla de errores y se descartan. Un CSV con al menos
  una fila valida se acepta parcialmente.

## 3. Modelo de datos

```typescript
/** Un lote de compra, ya sea real (del CSV) o sintetico (generado por una simulacion). */
type Lot = {
  date: string; // ISO YYYY-MM-DD
  ticker: string;
  quantity: number;
  price: number;
  comment?: string;
};

/** Barra diaria de precio. `adjClose` viene ajustado por splits y dividendos. */
type PriceBar = {
  date: string;
  close: number;
  adjClose: number;
};

type PriceHistory = {
  ticker: string;
  firstTradeDate: string;
  bars: Array<PriceBar>; // ordenado ascendente por fecha
};

type SeriesPoint = {
  date: string;
  invested: number; // capital acumulado hasta esa fecha
  value: number; // valor de mercado en esa fecha
  growthPct: number;
};

type PortfolioSeries = {
  label: string;
  points: Array<SeriesPoint>;
  totalInvested: number;
  finalValue: number;
  growthPct: number;
};
```

## 4. Los cuatro problemas dificiles

Estos puntos son donde el proyecto se rompe si se implementan mal. Conviene resolverlos
antes de escribir cualquier UI.

### 4.1. No hay un solo calendario de mercado

El CSV mezcla ETFs (`SPYG`, `VXUS`, `SMH`) que cotizan de lunes a viernes con `BTC-USD` que
cotiza los siete dias. Iterar "dias habiles" da un portafolio donde el BTC se congela los
fines de semana; iterar todos los dias deja huecos en los ETFs.

Solucion: el eje temporal es la **union ordenada de las fechas** de todos los historicos
involucrados. Para cada fecha, cada ticker se valora con su ultima barra conocida en o
antes de esa fecha (forward fill). Un ETF simplemente mantiene su precio del viernes durante
el fin de semana.

### 4.2. Splits y dividendos

Si un lote dice "10 acciones a 500 USD" y despues hubo un split 4:1, valuar esas 10 acciones
al precio de hoy da un resultado cuatro veces menor al real. La cantidad del CSV esta
expresada en terminos pre-split.

Solucion: normalizar todo lote a **cantidad ajustada** al cargarlo, usando el factor
implicito de la barra de su fecha.

```typescript
const factor = bar.adjClose / bar.close;
const adjustedQuantity = quantity / factor;
// A partir de aca: value(t) = adjustedQuantity * bar(t).adjClose
```

Como `adjClose` incorpora dividendos, el motor asume reinversion de dividendos. Es una
decision valida para un simulador de "que hubiera pasado", pero hay que decirlo en la UI
para que el numero no se lea como un estado de cuenta.

### 4.3. Lotes con costo cero

El CSV trae 9 lotes de `BTC-USD` con `Purchase Price = 0.0` y cantidades minimas
(`9.0E-6`), marcados con comentarios tipo "Dual". Son BTC recibido gratis, no comprado.

Rompen dos cosas:

- **Crecimiento porcentual**: aportan valor sin aportar capital, o sea retorno infinito.
  Matematicamente es correcto pero distorsiona la comparacion.
- **Sustitucion**: preservar capital significa que cero capital compra cero acciones del
  ticker nuevo, con lo cual esos lotes desaparecen de la simulacion.

Decision: se cargan como lotes normales con `price = 0`, cuentan para el valor de mercado y
no para el capital invertido. La UI expone un toggle **"Excluir lotes de costo cero"**,
apagado por defecto, y muestra un aviso cuando la comparacion incluye lotes que la
simulacion no puede replicar.

No filtrarlos en silencio ni tratarlos como error de parseo.

### 4.4. Fechas que no son dias de cotizacion

Un lote puede caer en feriado o en un dia sin barra. Toda lectura de precio pasa por un
resolvedor unico.

```typescript
/** Busca la primera barra en o despues de `date`. Devuelve null si se paso del historico. */
function resolveBar(history: PriceHistory, date: string): PriceBar | null;

/** Busca la ultima barra en o antes de `date`, para el forward fill de la serie. */
function lastBarAsOf(history: PriceHistory, date: string): PriceBar | null;
```

Nunca leer `bars.find(b => b.date === date)` directo en ningun otro lado.

## 5. Capa de datos de mercado

Route Handlers en `app/api/`, todos server-side.

| Endpoint           | Parametros               | Devuelve                       |
| ------------------ | ------------------------ | ------------------------------ |
| `GET /api/history` | `tickers` (coma), `from` | `Record<string, PriceHistory>` |
| `GET /api/quote`   | `tickers` (coma)         | precio actual por ticker       |
| `GET /api/search`  | `q`                      | candidatos para autocompletado |

Notas de implementacion:

- Usar `yahooFinance.chart()` con `interval: '1d'`, que devuelve `close` y `adjclose`.
- Cachear por `ticker + from` en memoria del server con TTL de 12 horas. Yahoo responde 429
  con facilidad y el usuario va a probar muchos tickers seguidos.
- Espejar el cache en `localStorage` del cliente para sobrevivir un refresh.
- Pedir siempre en lote, nunca un request por ticker dentro de un loop.
- `yahoo-finance2` es un cliente no oficial. Aislar toda la libreria en
  `lib/market/yahoo.ts` para poder cambiar de proveedor sin tocar el resto.

### Validacion de cobertura historica

Antes de aceptar un ticker de reemplazo, verificar que tenga historia suficiente:

```typescript
/** Un ticker sirve como reemplazo si ya cotizaba antes del lote mas viejo a sustituir. */
function hasCoverage(history: PriceHistory, earliestLotDate: string): boolean;
```

La fecha a cubrir es la del lote mas viejo **del ticker que se esta sustituyendo**, no la
del portafolio completo. Sustituir `BTC-USD` (desde 2025-02-10) exige menos historia que
sustituir `SPYG` (desde 2024-04-04).

Si no cubre, la UI bloquea la seleccion y muestra desde cuando existe el ticker. No truncar
el rango en silencio: un portafolio simulado que arranca mas tarde tiene un crecimiento
inflado y el usuario no tiene forma de notarlo.

## 6. Motor de calculo

Archivo `lib/portfolio/engine.ts`. Funciones puras, sin fetch, sin React. Es el lugar
natural para los tests unitarios.

```typescript
/** Construye la serie de valor e inversion acumulada, dia a dia. */
function buildSeries(
  lots: Array<Lot>,
  histories: Record<string, PriceHistory>,
  label: string
): PortfolioSeries;

/** Reemplaza los lotes de un ticker por lotes del ticker destino, preservando el capital. */
function substituteTicker(
  lots: Array<Lot>,
  from: string,
  to: PriceHistory
): Array<Lot>;

/** Reparte el capital de cada lote entre varios tickers segun los pesos indicados. */
function distribute(
  lots: Array<Lot>,
  weights: Array<{ ticker: string; weight: number }>,
  histories: Record<string, PriceHistory>
): Array<Lot>;
```

`buildSeries` recorre la union de fechas de los historicos involucrados. Para cada fecha
acumula los lotes ya ejecutados y valora la posicion con forward fill. `invested` es la suma
de `quantity * price` de los lotes hasta ese dia, sin ajustar.

Lo que preservan las simulaciones es el **capital**, no la cantidad de acciones:

```typescript
const capital = lot.quantity * lot.price;
const bar = resolveBar(target, lot.date);
const syntheticQuantity = capital / bar.close; // se permiten fracciones
```

Esto es lo que hace la comparacion honesta. Si se preservara la cantidad, un ticker mas caro
pareceria mejor inversion solo por costar mas.

En `distribute`, los pesos deben sumar 100 por ciento. Validarlo en el borde, no dentro del
motor.

## 7. Fases

Cada fase es un commit. El usuario prueba la app antes de cada uno, segun `agent.md`.

### Fase 0 - Bootstrap

`yarn create next-app` con TypeScript, Tailwind, App Router y ESLint. Instalar
`yahoo-finance2`, `papaparse`, `recharts`. Configurar Prettier.

**Prueba**: `yarn dev` levanta y muestra la pagina.
**Commit**: `chore: bootstrap next.js project with base dependencies`

### Fase 1 - Importacion de CSV

Dropzone, parseo del export de Yahoo, mapeo de columnas, validacion por fila, tabla de lotes
cargados, tabla de errores, persistencia en `localStorage`.

**Prueba**: cargar el `portfolio.csv` real y verificar 140 lotes, 4 simbolos, y los 9 lotes
de costo cero marcados. Probar tambien un CSV con header incorrecto.
**Commit**: `feat: yahoo portfolio csv import with per-row validation`

### Fase 2 - Capa de mercado

`lib/market/yahoo.ts`, los tres Route Handlers, cache con TTL, manejo de errores de red y de
ticker inexistente.

**Prueba**: pegarle a `/api/history?tickers=SPYG,BTC-USD&from=2024-04-04` desde el browser y
confirmar que el segundo request sale del cache.
**Commit**: `feat: yahoo finance market data layer with caching`

### Fase 3 - Motor de portafolio

`engine.ts` completo con ajuste por splits, union de calendarios y forward fill. Tests
unitarios con un historico fijo, cubriendo: un split, un lote en feriado, y un calendario
mixto de cripto con ETF.

**Prueba**: `yarn test` en verde, y un caso conocido calculado a mano contra la serie.
**Commit**: `feat: portfolio valuation engine with split adjustment`

### Fase 4 - Dashboard real

Tarjetas de resumen (invertido, valor actual, ganancia, crecimiento porcentual), grafica de
valor total, grafica de crecimiento porcentual, desglose por posicion, toggle de lotes de
costo cero.

**Prueba**: cargar el CSV propio y contrastar el valor actual contra el broker real.
**Commit**: `feat: portfolio dashboard with value and growth charts`

### Fase 5 - Sustitucion de ticker

Selector de ticker origen, autocompletado del destino, validacion de cobertura historica,
grafica comparativa con las dos series superpuestas.

**Prueba**: sustituir `SPYG` por otro ETF con historia suficiente, y despues intentar con un
ticker que cotiza desde 2025 para ver el bloqueo.
**Commit**: `feat: ticker substitution simulation with coverage validation`

### Fase 6 - Distribucion por porcentajes

Editor de pesos con validacion de suma 100, generacion de lotes sinteticos repartidos, misma
grafica comparativa.

**Prueba**: repartir 60/40 entre dos tickers y verificar que el capital invertido total
coincide con el del portafolio original.
**Commit**: `feat: multi-ticker weighted distribution simulation`

### Fase 7 - Pulido

Estados de carga, mensajes de error legibles, estado vacio, CSV de ejemplo descargable,
aviso sobre el supuesto de reinversion de dividendos.

**Prueba**: recorrido completo desde cero con cache limpio.
**Commit**: `chore: loading states, error handling and empty states`

## 8. Estructura de archivos

```
app/
  api/
    history/route.ts
    quote/route.ts
    search/route.ts
  page.tsx
  layout.tsx
components/
  csv/
    CsvDropzone.tsx
    LotTable.tsx
  charts/
    ValueChart.tsx
    GrowthChart.tsx
    ComparisonChart.tsx
  simulation/
    TickerSubstitution.tsx
    WeightDistribution.tsx
  summary/
    SummaryCards.tsx
lib/
  market/
    yahoo.ts        // unico punto de contacto con la libreria
    cache.ts
  portfolio/
    engine.ts       // funciones puras, testeadas
    engine.test.ts
    types.ts
  csv/
    parser.ts
state/
  portfolio-context.tsx
```

## 9. Fuera de alcance del MVP

Se dejan afuera a proposito, para no comprometer el diseno ahora:

- Autenticacion y portafolios persistidos por usuario.
- Ventas y posiciones cerradas. El CSV actual es 100 por ciento `BUY`.
- Multi divisa. Todo se asume en USD.
- Impuestos. Las comisiones vienen en cero en el CSV actual.
- Aportes periodicos automaticos tipo DCA configurables.

Las ventas son la extension mas probable a futuro. Para dejar la puerta abierta sin
implementarlas, que `Lot` sea el unico tipo que el motor conoce y que `quantity` admita
valores negativos a nivel conceptual, aunque el parser los rechace hoy.
