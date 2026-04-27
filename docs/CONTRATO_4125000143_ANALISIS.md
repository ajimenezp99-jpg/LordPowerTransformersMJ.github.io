# Análisis estructural · Contrato 4125000143

> Reporte de FASE A (micro-cirugía deploy contract dataset).
> Generado a partir del diff entre el template canónico
> `Gestion_Suministros_Transformadores-2.xlsm` y el archivo del
> contrato `Gestion_Suministros_Transformadores_4125000143.xlsm`.

## 1. Inventario de partes ZIP

Idéntico en ambos archivos (35 entries):
`xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/sharedStrings.xml`,
`xl/styles.xml`, `xl/calcChain.xml`, `xl/theme/theme1.xml`,
`xl/charts/chart{1,2}.xml`, `xl/drawings/drawing{1,2}.xml`,
`xl/tables/table{1,2,3,4}.xml`, `xl/worksheets/sheet{1..8}.xml`,
`xl/worksheets/_rels/sheet{2,3,5,6,7,8}.xml.rels`,
`xl/vbaProject.bin`, `xl/webextensions/{taskpanes,webextension1}.xml`,
`docProps/{app,core}.xml`, `_rels/.rels`, `[Content_Types].xml`.

→ **Conclusión:** estructura compatible. El export espejo puede
re-empaquetar al template y reemplazar partes XML específicas sin
romper el contrato OOXML.

## 2. Workbook (`xl/workbook.xml`)

Hojas idénticas (mismo `r:id`, mismo `sheetId`, mismos `name`):

| sheetId | r:id | name | state |
|---|---|---|---|
| 1 | rId1 | README | visible |
| 2 | rId2 | Catalogo_Suministros | visible |
| 3 | rId3 | Marcas | visible |
| 4 | rId4 | ListasMarcas | **hidden** |
| 5 | rId5 | Equipos | visible |
| 6 | rId6 | Movimientos | visible |
| 7 | rId7 | Entrega | visible |
| 8 | rId8 | Dashboard | visible |

`definedNames` idénticos (47 nombres):
- 18 `ent_*` (celdas del formulario Entrega).
- 4 `flt_*` (filtros del Dashboard).
- 22 `S01..S22` apuntando a `ListasMarcas!${COL}$3:${COL}$3` para el
  data validation de la columna *Marca* en hoja `Marcas`.

Diferencias cosméticas (no afectan función): `absPath`, `bookView`
windowing, `revisionPtr/uidLastSave`, `calcId 191028 vs 191029`,
`fileVersion codeName GUID`, `rupBuild 30015 vs 11018`.

⚠️ **Gap crítico:** el archivo nuevo añade S23/S24/S25 al catálogo
pero el `definedName` para esos códigos **no existe**. Las dropdowns
de marca para los nuevos SKUs no funcionarán hasta que el export
extienda los `definedNames` (FASE E).

## 3. Tablas (`xl/tables/table{N}.xml`)

| Tabla | Nombre | Template ref | Nuevo ref | Notas |
|---|---|---|---|---|
| 1 | tblSuministros | B3:J25 | **B3:J28** | +3 filas datos |
| 2 | tblMarcas | B3:D25 | **B3:D28** | +3 filas datos, `dataDxfId` añadido |
| 3 | tblEquipos | B3:J209 | B3:J209 | idéntico |
| 4 | tblMovimientos | B4:Q5 | B4:Q5 | sin datos en ambos |

Columnas y `tableColumn id` idénticos en las 4 tablas (ver doc de
parsers para diccionario completo).

## 4. Datos por hoja

### 4.1 Catalogo_Suministros (sheet2)

Schema (header en B3): `ID | Nombre | Unidad | Stock_Inicial | Total_Ingresado | Total_Egresado | Stock_Actual | Alerta | Marcas_Disponibles`.

Template: 22 SKUs (S01–S22).
Nuevo: **25 SKUs (S01–S25)**.

SKUs nuevos en el contrato:

| ID | Nombre | Unidad | Stock_Inicial | Marca |
|---|---|---|---|---|
| S23 | Buje 13,8 kV | Und | 3 | CEDASPE |
| S24 | Buje 34,5 kV | Und | 3 | CEDASPE |
| S25 | Buje 66/110 kV | Und | 6 | RHM Internacional USA |

Patrón regex `^S\d{2}$` los acepta. El `SUMINISTRO_CODIGO_PATTERN`
del dominio y el `isCodigoSuministroValido()` de las reglas
Firestore tampoco bloquean — son backwards-compatible.

### 4.2 Marcas (sheet3)

Espejo 1:1 del catálogo: una fila por suministro con su marca
"vigente" para el contrato.

### 4.3 ListasMarcas (sheet4, hidden)

**Cambio estructural:**
- Template: 3 filas × 22 cols. Row 1 = ID, row 2 = nombre largo,
  row 3 = marca actual. Los `definedName`s apuntan a la fila 3.
- Nuevo: **2 filas × 25 cols**. Row 1 = ID, row 2 = marca actual.
  Los `definedName` siguen apuntando a `$3:$3` → quedan apuntando
  a celdas vacías → dropdown roto en hoja Marcas.

→ **Decisión para FASE E:** el export reescribirá ListasMarcas con
el layout estable (3 filas: ID / nombre / marca actual) y mantendrá
los `definedName`s alineados a la fila 3. Esto cierra el gap con
S23/S24/S25 y restaura las dropdowns.

### 4.4 Equipos (sheet5, tblEquipos)

206 transformadores. **Lista idéntica** entre template y nuevo
(diff de IDs: 0 únicos en cualquiera de los dos lados). El parque
de transformadores no cambió con el contrato 4125000143.

### 4.5 Movimientos (sheet6, tblMovimientos)

Vacío en ambos archivos. Solo header `Año | Movimiento_ID |
Equipo_ID | Equipo_Descripcion | Zona | Departamento | Subestacion
| Matricula | Suministro_ID | Suministro_Nombre | Marca | Cantidad
| Tipo | Usuario | Observaciones | ODT`.

→ **No hay histórico de movimientos a migrar** desde el archivo del
contrato. La colección Firestore `/movimientos` arranca en cero
para el contrato 4125000143.

### 4.6 Entrega (sheet7, formulario activo)

El archivo viene con un **egreso pre-cargado pendiente**:
- Tipo: EGRESO · Año 2026 · Usuario "Brayan Parra"
- Subestación: TOLU VIEJO · SUCRE · OCCIDENTE · matrícula T1A-A/M-TVJ
  (transformador 60000 kVA)
- Suministro: S25 "Buje 66/110 KV" · marca RHM Internacional USA · cant 1
- Stock actual: 6 · stock final: 5 · estado "🟢 LISTO PARA CONFIRMAR"

→ Este movimiento **NO está consolidado** en sheet6. Es input vivo
del macro. Decisión propuesta: el seeder NO lo procesa (la hoja
Entrega es transitoria); si el director quiere registrar este
egreso, lo hace por la UI de movimientos cuando la importación esté
en producción.

### 4.7 Dashboard (sheet8)

KPIs y gráficas. No requiere ingesta — se reconstruye por fórmulas
referenciando tblMovimientos. Las refs de filtros (`flt_zona`,
`flt_dep`, `flt_eq`, `flt_sub`) están en el rango D50:I51 y se
preservan tal cual al reescribir.

## 5. `vbaProject.bin`

| Archivo | md5 |
|---|---|
| Template | `5ab76c9fd5dbb96cc41b1ca6c5ec84b8` |
| Nuevo    | `c88a6735e3a68f746d1b907bb6bd2e18` |

→ **Difieren.** El template tiene macros más actualizados (último
build `30015` vs `11018` del nuevo). El export debe usar el
`vbaProject.bin` del **template** como base (es la fuente de verdad
oficial), no el del archivo del contrato. Esto se alinea con el
principio "un solo template canónico, contratos son data" — los
macros viven en el template.

## 6. Issues colaterales detectados (no bloqueantes para deploy del contrato pero importantes)

### 6.1 ⚠️ Bug pre-existente en `firestore.rules` para multi-contrato

Línea 496 de `firestore.rules`:

```
allow create: if isAdmin()
              && isCodigoSuministroValido(request.resource.data.codigo)
              && request.resource.data.codigo == id     // ← bloquea N3
              ...
```

Pero N5 (commit `aac5994`) escribe con docId composite
`{contrato_id}_{codigo}` mientras `data.codigo` queda como `Sxx`
plano. La regla rechaza el write contra producción.

Las reglas **nunca se actualizaron** entre F40 (que las introdujo
con el supuesto "docId == codigo") y N5 (que rompió ese supuesto).

→ FASE E (o una fase intermedia) debe relajar la regla a:
`request.resource.data.codigo == id || id.matches('^[0-9]{8,14}_S[0-9]{2}$')`
o equivalente. Misma corrección para `/marcas` y `/movimientos` en
caso de pasar a docId composite.

### 6.2 ⚠️ `definedName` S23..S25 ausentes

Si se importa el contrato y luego se exporta a `.xlsm`, las celdas
de la columna *Marca* en hoja Marcas para S23/S24/S25 no tendrán
data validation (dropdown roto). El export espejo (FASE E) debe
inyectar 3 `definedName` adicionales y ampliar `ListasMarcas` a 25
columnas con la fila 3 poblada.

## 7. Implicancias para el plan original

| Fase del plan | Cambio respecto al plan inicial |
|---|---|
| FASE B (parser dryrun) | El parser actual debe leer 25 SKUs sin tocar nada (regex S\d{2} acepta S23–S25). Confirma con test. |
| FASE C (ajuste parser) | Probable **no-op** — el parser solo recorre filas hasta donde haya datos. |
| FASE D (seeder) | Importa 25 suministros + 25 marcas + 0 movimientos para `contrato_id=4125000143`. |
| FASE E (export espejo) | **Más alcance del previsto:** además de sheet6/table4 (movimientos) hay que reescribir sheet2/table1, sheet3/table2, sheet4 (ListasMarcas) y workbook.xml (definedNames extendidos). Tabla `tblEquipos` no se toca (idéntica). El `vbaProject.bin` se preserva del template canónico. |
| FASE pre-E (rules) | **Nueva sub-fase necesaria:** corregir `firestore.rules` para aceptar docId composite en `/suministros`, `/marcas`, `/movimientos`. Sin esto, el import server-side falla en producción. |

## 8. Decisiones cerradas

1. **Template canónico** = `Gestion_Suministros_Transformadores-2.xlsm`. Su `vbaProject.bin` se usa siempre en exports.
2. **El archivo del contrato (4125000143.xlsm) es solo fuente de datos**, no template. Sus macros desactualizados se descartan.
3. **+3 SKUs (S23/S24/S25)** entran al catálogo del contrato 4125000143 sin extender el catálogo del contrato 4123000081. Aislamiento garantizado por `composeDocId` y `contrato_id` en el payload.
4. **Movimiento pendiente en hoja Entrega del archivo del contrato no se migra** — es input transitorio del usuario.
5. **Reglas Firestore** se corrigen como parte del trabajo (pre-FASE E) — son blocker conocido.
