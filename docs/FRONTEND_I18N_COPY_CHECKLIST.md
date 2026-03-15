# Frontend I18N Copy Review Checklist

## Objetivo
Checklist operativo para revisar textos fijos (`UI copy`) en cada iteración sin romper tenant i18n.

## Checklist obligatoria por PR
- [ ] Toda nueva cadena visible al usuario en tenant (`landing`, `client`, `admin`) usa `t('...')` o `translateUi(...)`.
- [ ] No hay textos hardcoded en componentes compartidos (`layout`, `dialogs`, `toasts`, `fallbacks`).
- [ ] Si se añade una key, existe en `frontend/src/i18n/locales/es.json` y `frontend/src/i18n/locales/en.json`.
- [ ] Placeholders interpolados (`{name}`, `{count}`) son idénticos entre `es/en`.
- [ ] `npm --prefix frontend run i18n:check` pasa en verde.
- [ ] `npm --prefix frontend run test:smoke:i18n` pasa en verde.
- [ ] `Platform` sigue bloqueado a español (`LanguageProvider` con `tenant.isPlatform` => `es`).
- [ ] Selector de idioma no aparece si `supportedLanguages.length <= 1`.
- [ ] Cambio de idioma desde footer y perfil persiste correctamente en storage.
- [ ] Fallback visual funciona: si falta traducción en idioma activo, se usa default tenant y luego `es`.

## Scope fuera de checklist
- Textos de `Platform` pueden permanecer en español por decisión de producto.
- Contenido dinámico editable del negocio se valida en backend (`LocalizationService`), no en este checklist de fixed-copy.
