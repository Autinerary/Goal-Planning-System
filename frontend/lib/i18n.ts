// Lightweight i18n — dependency-free.
//
// A small translation dictionary + helpers. We avoid a full framework so this
// stays easy to extend during Phase 3. Language is persisted in user
// preferences (localStorage) and applied app-wide via the LanguageProvider.
//
// To add a language: add its code to LANGUAGES and a block to `dictionaries`.
// Missing keys fall back to English, then to the key itself.

export type LanguageCode = 'en' | 'es' | 'fr' | 'zh'

export const LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
]

// Common UI strings. Keys are stable identifiers; values are the display text.
type Dict = Record<string, string>

const en: Dict = {
  'nav.settings': 'Settings',
  'nav.howItWorks': 'How it works',
  'nav.findResources': 'Find Resources',
  'nav.logout': 'Logout',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.skip': 'Skip',
  'common.getStarted': 'Get started',
  'common.save': 'Save',
  'path.title': 'Your Path',
  'races.title': 'Races',
  'journal.title': 'Journal',
  'journal.allEntries': 'All Entries',
  'settings.accessibility': 'Accessibility',
  'settings.language': 'Language',
}

const es: Dict = {
  'nav.settings': 'Ajustes',
  'nav.howItWorks': 'Cómo funciona',
  'nav.findResources': 'Buscar recursos',
  'nav.logout': 'Cerrar sesión',
  'common.back': 'Atrás',
  'common.next': 'Siguiente',
  'common.skip': 'Omitir',
  'common.getStarted': 'Empezar',
  'common.save': 'Guardar',
  'path.title': 'Tu camino',
  'races.title': 'Carreras',
  'journal.title': 'Diario',
  'journal.allEntries': 'Todas las entradas',
  'settings.accessibility': 'Accesibilidad',
  'settings.language': 'Idioma',
}

const fr: Dict = {
  'nav.settings': 'Paramètres',
  'nav.howItWorks': 'Comment ça marche',
  'nav.findResources': 'Trouver des ressources',
  'nav.logout': 'Déconnexion',
  'common.back': 'Retour',
  'common.next': 'Suivant',
  'common.skip': 'Passer',
  'common.getStarted': 'Commencer',
  'common.save': 'Enregistrer',
  'path.title': 'Votre parcours',
  'races.title': 'Courses',
  'journal.title': 'Journal',
  'journal.allEntries': 'Toutes les entrées',
  'settings.accessibility': 'Accessibilité',
  'settings.language': 'Langue',
}

const zh: Dict = {
  'nav.settings': '设置',
  'nav.howItWorks': '使用指南',
  'nav.findResources': '查找资源',
  'nav.logout': '退出登录',
  'common.back': '返回',
  'common.next': '下一步',
  'common.skip': '跳过',
  'common.getStarted': '开始',
  'common.save': '保存',
  'path.title': '你的路径',
  'races.title': '赛程',
  'journal.title': '日志',
  'journal.allEntries': '所有记录',
  'settings.accessibility': '无障碍',
  'settings.language': '语言',
}

const dictionaries: Record<LanguageCode, Dict> = { en, es, fr, zh }

/** Translate a key for the given language, falling back to English then the key. */
export function translate(lang: LanguageCode, key: string): string {
  return dictionaries[lang]?.[key] ?? en[key] ?? key
}
