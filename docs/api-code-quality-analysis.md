# Análisis de API - Church SaaS

**Fecha:** 2026-01-24  
**Última actualización:** 2026-01-24

## Resumen de Puntuaciones

| Categoría | Puntuación | 
|-----------|------------|
| Arquitectura | **10/10** |
| DRY | **9/10** |
| Limpieza | **9/10** |
| Manejo de Errores | **9/10** |
| Seguridad | **8/10** |
| Testing | **9/10** |
| Consistencia | **10/10** |
| Observabilidad | **9/10** |
| Configuración | **9/10** |
| TypeScript | **9/10** |

**Promedio General: 9.1/10**

---

## Detalles por Categoría

### 1. Arquitectura — 10/10

**Fortalezas:**
- Clara separación de capas: `routes/` → `controllers/` → `db/`
- Organización por dominio de negocio (auth, tenants, people, teams, events)
- Uso de plugins de Elysia para inyección de dependencias (`contextPlugin`)
- Guards reutilizables para autorización (`authGuard`, `adminGuard`, `tenantUserGuard`, `tenantManagerGuard`)
- Schemas Drizzle + Zod compartidos en paquete `@church/shared` (integración `drizzle-zod`)
- Patrón consistente de separación de rutas por nivel de acceso (`adminRoutes`, `userRoutes`, `managerRoutes`)
- **Estructura de `lib/` organizada por responsabilidad:**
  - `lib/auth/` - JWT, Google OAuth, helpers de autenticación
  - `lib/elysia/` - Context plugin y guards
  - `lib/infra/` - Logger, MinIO, OpenTelemetry
  - `lib/http-errors.ts`, `lib/params.ts` - Utilidades generales
- **Query helpers centralizados en `db/queries.ts`**

**Nota sobre monorepo:**
```
packages/shared/
  db/           ← Drizzle schemas (origen de verdad)
  schemas.ts    ← Zod validators (generados con drizzle-zod)

apps/api/src/db/
  schema.ts     ← Re-exporta desde @church/shared
  queries.ts    ← Query helpers locales
```

Los controladores reciben `db` como primer parámetro - patrón correcto para arquitecturas funcionales request-based. No se necesita capa de servicios adicional para este tamaño de proyecto.

---

### 2. DRY — 9/10

**Fortalezas:**
- `contextPlugin` evita repetir lógica de autenticación
- Guards reutilizables (`authGuard`, `tenantUserGuard`, etc.)
- Helpers como `firstOrThrow`, `parseId` evitan código repetitivo
- Schemas Zod compartidos desde `@church/shared` (generados automáticamente con `drizzle-zod`)
- Fixtures de tests reutilizables (`createAccessFixture`, `createTenantFixture`)
- **Query helpers** en `db/queries.ts` para patrones comunes:
  - `findPersonById`, `findPersonInTenant`, `findHelperInTenant`
  - `findEmailByAddress`, `findTenantOwner`, `findTenantWithPlan`
  - `isTenantManager`, `hasAccessToTenant`, `isActiveTenantUser`
- **Lógica de creación de tenant unificada** con `createTenantCore` y `validateTenantCreation`

---

### 3. Limpieza — 9/10

**Fortalezas:**
- Código bien formateado y legible
- Nombres descriptivos de funciones y variables
- Imports organizados por categoría
- Archivos pequeños y enfocados (single responsibility)
- Documentación con JSDoc en funciones clave
- Estructura de carpetas clara y predecible
- ESLint configurado y pasando sin errores

---

### 4. Manejo de Errores — 9/10

**Fortalezas:**
- Sistema de errores HTTP tipado (`HttpError`, `badRequest`, `notFound`, etc.)
- Handler centralizado en `app.ts` (`onError`)
- Validación automática con Zod + respuesta 422
- Errores específicos con mensajes descriptivos
- **Códigos de error estructurados** (`ErrorCode` enum):
  - `VALIDATION_ERROR`, `INVALID_INPUT`, `NOT_AUTHENTICATED`, `FORBIDDEN`
  - `NOT_FOUND`, `ALREADY_EXISTS`, `CONFLICT`
  - `UNIQUE_VIOLATION`, `FOREIGN_KEY_VIOLATION`, `INTERNAL_ERROR`
- **Wrapping de errores de DB** con `wrapDbError`:
  - Constraint violations → mensajes amigables
  - Extracción automática de nombre de campo desde constraints
  - Soporte para unique, foreign key, not null, check violations

**Áreas de mejora:**
- Auditoría de errores críticos (logging a sistema externo)

---

### 5. Seguridad — 8/10

**Fortalezas:**
- JWT en cookies httpOnly
- CORS restringido a orígenes específicos
- Guards de autorización por tenant
- Protección CSRF para mutaciones
- Validación de inputs con Zod
- Passwords/secrets en variables de entorno
- UUIDs para IDs sensibles (previene enumeración)
- Rate limiting via nginx

**Áreas de mejora:**
- No hay auditoría de acciones sensibles (quién borró qué, cuándo)

---

### 6. Testing — 9/10

**Fortalezas:**
- 25 archivos de tests - 124 tests pasando
- Tests de integración completos a nivel de rutas HTTP
- Fixtures reutilizables (`createAccessFixture`, `createTenantFixture`, `createTeam`, etc.)
- Coverage configurado con exclusiones apropiadas
- Tests cubren casos edge (cross-tenant, permisos, validación, incompatibilidad de skills)
- Cleanup automático en `afterAll`
- Mocks correctamente configurados para servicios externos (MinIO, Sharp)

**Coverage actual:**
| Área | Coverage |
|------|----------|
| controllers/events | 93% |
| controllers/people | 85% |
| controllers/teams | 88% |
| controllers/tenants | 84% |
| routes/* | 100% |

---

### 7. Consistencia — 10/10

**Fortalezas:**
- Patrón consistente: rutas → controladores → DB
- Nomenclatura uniforme (`createX`, `listX`, `getX`, `updateX`, `deleteX`)
- Estructura de archivos predecible
- Guards aplicados de manera uniforme
- Responses consistentes (`{ success: true }` para deletes)
- Patrón uniforme de separación de rutas por nivel de acceso en todos los archivos
- **Nombres de parámetros consistentes**: `params.tenantId`, `params.personId`, `params.teamId`, etc. (no `params.id` genérico)

---

### 8. Observabilidad — 9/10

**Fortalezas:**
- OpenTelemetry con auto-instrumentación (HTTP, DB, DNS)
- Pino logger con contexto OTEL (trace_id, span_id)
- Logging de requests HTTP con duración
- Soporte para Loki en producción
- Pretty print en desarrollo
- Health endpoint

**Áreas de mejora:**
- No hay métricas custom (counters, histograms)

---

### 9. Configuración — 9/10

**Fortalezas:**
- Validación completa con Zod (`env.ts`)
- Fail-fast con mensajes claros si hay variables inválidas
- Separación de config por servicio (db, minio, google, jwt, otel)
- Validación de formatos (URLs, puertos, longitud mínima de JWT_SECRET)

**Áreas de mejora:**
- No hay profiles de ambiente (dev, staging, prod)

---

### 10. TypeScript — 9/10

**Fortalezas:**
- Tipos exportados para todas las entidades (`Tenant`, `Person`, etc.)
- Zod para validación + inferencia de tipos
- `UserPayload` tipado para JWT
- Drizzle proporciona tipos automáticos
- TSC y ESLint pasando sin errores
- **Branded types para IDs**: `TenantId`, `PersonId`, `EmailId` en `packages/shared/src/branded-types.ts`

---

## Verificación de Calidad

```
✅ pnpm lint          → 0 errores
✅ tsc --noEmit       → 0 errores (api + shared)
✅ pnpm test          → 124/124 tests pasando
```

---

## Recomendaciones Pendientes

1. **Seguridad**: Implementar audit logging para acciones sensibles
2. **Observabilidad**: Agregar métricas custom (counters, histograms)
3. **Configuración**: Considerar profiles de ambiente (dev, staging, prod)

---

## Historial de Mejoras

- ✅ Refactorizado `createTenantWithOwner` y `setupTenantFromPending` para compartir lógica común
- ✅ Creado `db/queries.ts` con ~170 líneas de helpers reutilizables
- ✅ Eliminados patrones repetidos de queries Drizzle en guards y controllers
- ✅ Reorganizado `lib/` en subdirectorios por responsabilidad (`auth/`, `elysia/`, `infra/`)
- ✅ Tests optimizados: eliminadas 5,500+ líneas redundantes manteniendo coverage
- ✅ Corregidos imports de mocks en tests (minio path actualizado)
- ✅ Limpiados imports no utilizados
- ✅ Añadidos códigos de error estructurados (`ErrorCode` enum)
- ✅ Añadido `wrapDbError` para errores de DB (constraint violations)
- ✅ Unificados nombres de parámetros de URL (`params.tenantId` en lugar de `params.id`)
- ✅ Migrado IDs sensibles a UUIDs (`tenants.id`, `people.id`, `emails.id`)
- ✅ Implementado branded types (`TenantId`, `PersonId`, `EmailId`)
- ✅ Validación de config con Zod (`env.ts`)

---

## Conclusión

La API está bien construida con patrones sólidos y arquitectura funcional apropiada para el contexto. La estructura de carpetas es clara y organizada por responsabilidad. Todos los checks de calidad pasan (lint, tsc, tests). Las principales áreas de mejora pendientes son auditoría de acciones sensibles y métricas custom.
