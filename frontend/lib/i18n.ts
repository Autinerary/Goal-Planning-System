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
  'nav.path': 'Path',
  'nav.races': 'Races',
  'nav.milestones': 'Milestones',
  'nav.tasks': 'Tasks',
  'nav.reflection': 'Reflection',
  'nav.profile': 'Profile',
  'nav.search': 'Search',
  'nav.help': 'Help',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.previous': 'Previous',
  'common.skip': 'Skip',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.done': 'Done',
  'common.continue': 'Continue',
  'common.getStarted': 'Get started',
  'common.save': 'Save',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.import': 'Import',
  'common.export': 'Export',
  'common.loading': 'Loading...',
  'common.resetToDefaults': 'Reset to defaults',
  'common.language': 'Language',
  'common.customize': 'Customize',
  'common.journeySnapshot': 'Your journey snapshot',
  'common.aiGenerated': 'AI-Generated',
  'path.title': 'Your Path',
  'races.title': 'Races',
  'milestones.title': 'Milestones',
  'tasks.title': 'Tasks',
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
  'nav.path': 'Ruta',
  'nav.races': 'Carreras',
  'nav.milestones': 'Hitos',
  'nav.tasks': 'Tareas',
  'nav.reflection': 'Reflexión',
  'nav.profile': 'Perfil',
  'nav.search': 'Buscar',
  'nav.help': 'Ayuda',
  'common.back': 'Atrás',
  'common.next': 'Siguiente',
  'common.previous': 'Anterior',
  'common.skip': 'Omitir',
  'common.cancel': 'Cancelar',
  'common.close': 'Cerrar',
  'common.done': 'Hecho',
  'common.continue': 'Continuar',
  'common.getStarted': 'Empezar',
  'common.save': 'Guardar',
  'common.edit': 'Editar',
  'common.delete': 'Eliminar',
  'common.import': 'Importar',
  'common.export': 'Exportar',
  'common.loading': 'Cargando...',
  'common.resetToDefaults': 'Restablecer valores predeterminados',
  'common.language': 'Idioma',
  'common.customize': 'Personalizar',
  'common.journeySnapshot': 'Tu resumen del camino',
  'common.aiGenerated': 'Generado por IA',
  'path.title': 'Tu camino',
  'races.title': 'Carreras',
  'milestones.title': 'Hitos',
  'tasks.title': 'Tareas',
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
  'nav.path': 'Parcours',
  'nav.races': 'Courses',
  'nav.milestones': 'Étapes',
  'nav.tasks': 'Tâches',
  'nav.reflection': 'Réflexion',
  'nav.profile': 'Profil',
  'nav.search': 'Recherche',
  'nav.help': 'Aide',
  'common.back': 'Retour',
  'common.next': 'Suivant',
  'common.previous': 'Précédent',
  'common.skip': 'Passer',
  'common.cancel': 'Annuler',
  'common.close': 'Fermer',
  'common.done': 'Terminé',
  'common.continue': 'Continuer',
  'common.getStarted': 'Commencer',
  'common.save': 'Enregistrer',
  'common.edit': 'Modifier',
  'common.delete': 'Supprimer',
  'common.import': 'Importer',
  'common.export': 'Exporter',
  'common.loading': 'Chargement...',
  'common.resetToDefaults': 'Réinitialiser par défaut',
  'common.language': 'Langue',
  'common.customize': 'Personnaliser',
  'common.journeySnapshot': 'Aperçu de votre parcours',
  'common.aiGenerated': 'Généré par IA',
  'path.title': 'Votre parcours',
  'races.title': 'Courses',
  'milestones.title': 'Étapes',
  'tasks.title': 'Tâches',
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
  'nav.path': '路径',
  'nav.races': '赛程',
  'nav.milestones': '里程碑',
  'nav.tasks': '任务',
  'nav.reflection': '反思',
  'nav.profile': '个人资料',
  'nav.search': '搜索',
  'nav.help': '帮助',
  'common.back': '返回',
  'common.next': '下一步',
  'common.previous': '上一步',
  'common.skip': '跳过',
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.done': '完成',
  'common.continue': '继续',
  'common.getStarted': '开始',
  'common.save': '保存',
  'common.edit': '编辑',
  'common.delete': '删除',
  'common.import': '导入',
  'common.export': '导出',
  'common.loading': '加载中...',
  'common.resetToDefaults': '恢复默认设置',
  'common.language': '语言',
  'common.customize': '自定义',
  'common.journeySnapshot': '你的旅程概览',
  'common.aiGenerated': 'AI 生成',
  'path.title': '你的路径',
  'races.title': '赛程',
  'milestones.title': '里程碑',
  'tasks.title': '任务',
  'journal.title': '日志',
  'journal.allEntries': '所有记录',
  'settings.accessibility': '无障碍',
  'settings.language': '语言',
}

const dictionaries: Record<LanguageCode, Dict> = { en, es, fr, zh }

const phraseKeyByEnglish: Record<string, string> = Object.entries(en).reduce((acc, [k, v]) => {
  acc[v.trim().toLowerCase()] = k
  return acc
}, {} as Record<string, string>)

type PhraseDict = Record<string, string>

const phraseBooks: Record<LanguageCode, PhraseDict> = {
  en: {},
  es: {
    'loading your path...': 'Cargando tu camino...',
    'your path': 'Tu camino',
    'races': 'Carreras',
    'milestones': 'Hitos',
    'tasks': 'Tareas',
    'journal': 'Diario',
    'all entries': 'Todas las entradas',
    'accessibility': 'Accesibilidad',
    'text size': 'Tamaño del texto',
    'high contrast': 'Alto contraste',
    'reduce motion': 'Reducir movimiento',
    'dyslexia-friendly font': 'Fuente apta para dislexia',
    'underline links': 'Subrayar enlaces',
    'reset to defaults': 'Restablecer valores predeterminados',
    'language': 'Idioma',
    'settings': 'Ajustes',
    'find resources': 'Buscar recursos',
    'how it works': 'Cómo funciona',
    'logout': 'Cerrar sesión',
    'back': 'Atrás',
    'next': 'Siguiente',
    'previous': 'Anterior',
    'skip': 'Omitir',
    'save': 'Guardar',
    'cancel': 'Cancelar',
    'continue': 'Continuar',
    'close': 'Cerrar',
    'done': 'Hecho',
    'import': 'Importar',
    'export': 'Exportar',
    'customize': 'Personalizar',
    'your journey snapshot': 'Tu resumen del camino',
    'ai-generated': 'Generado por IA',
    'path market': 'Mercado de rutas',
    'profile': 'Perfil',
    'search': 'Buscar',
    'help': 'Ayuda',
  },
  fr: {
    'loading your path...': 'Chargement de votre parcours...',
    'your path': 'Votre parcours',
    'races': 'Courses',
    'milestones': 'Étapes',
    'tasks': 'Tâches',
    'journal': 'Journal',
    'all entries': 'Toutes les entrées',
    'accessibility': 'Accessibilité',
    'text size': 'Taille du texte',
    'high contrast': 'Contraste élevé',
    'reduce motion': 'Réduire les animations',
    'dyslexia-friendly font': 'Police adaptée à la dyslexie',
    'underline links': 'Souligner les liens',
    'reset to defaults': 'Réinitialiser par défaut',
    'language': 'Langue',
    'settings': 'Paramètres',
    'find resources': 'Trouver des ressources',
    'how it works': 'Comment ça marche',
    'logout': 'Déconnexion',
    'back': 'Retour',
    'next': 'Suivant',
    'previous': 'Précédent',
    'skip': 'Passer',
    'save': 'Enregistrer',
    'cancel': 'Annuler',
    'continue': 'Continuer',
    'close': 'Fermer',
    'done': 'Terminé',
    'import': 'Importer',
    'export': 'Exporter',
    'customize': 'Personnaliser',
    'your journey snapshot': 'Aperçu de votre parcours',
    'ai-generated': 'Généré par IA',
    'path market': 'Marché des parcours',
    'profile': 'Profil',
    'search': 'Recherche',
    'help': 'Aide',
  },
  zh: {
    'loading your path...': '正在加载你的路径...',
    'your path': '你的路径',
    'races': '赛程',
    'milestones': '里程碑',
    'tasks': '任务',
    'journal': '日志',
    'all entries': '所有记录',
    'accessibility': '无障碍',
    'text size': '文字大小',
    'high contrast': '高对比度',
    'reduce motion': '减少动效',
    'dyslexia-friendly font': '阅读友好字体',
    'underline links': '链接加下划线',
    'reset to defaults': '恢复默认设置',
    'language': '语言',
    'settings': '设置',
    'find resources': '查找资源',
    'how it works': '使用指南',
    'logout': '退出登录',
    'back': '返回',
    'next': '下一步',
    'previous': '上一步',
    'skip': '跳过',
    'save': '保存',
    'cancel': '取消',
    'continue': '继续',
    'close': '关闭',
    'done': '完成',
    'import': '导入',
    'export': '导出',
    'customize': '自定义',
    'your journey snapshot': '你的旅程概览',
    'ai-generated': 'AI 生成',
    'path market': '路径市场',
    'profile': '个人资料',
    'search': '搜索',
    'help': '帮助',
  },
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/** Translate a key for the given language, falling back to English then the key. */
export function translate(lang: LanguageCode, key: string): string {
  return dictionaries[lang]?.[key] ?? en[key] ?? key
}

/**
 * Phrase-based translation for existing hardcoded UI copy.
 *
 * This lets us translate already-rendered app text without rewriting every
 * component at once. It first maps English phrases that already exist in the
 * key dictionary, then checks a phrase book for common UI copy.
 */
export function translatePhrase(lang: LanguageCode, rawText: string): string {
  if (!rawText || lang === 'en') return rawText
  const normalized = normalizeText(rawText)
  if (!normalized) return rawText

  const dictKey = phraseKeyByEnglish[normalized.toLowerCase()]
  if (dictKey) {
    return translate(lang, dictKey)
  }

  return phraseBooks[lang]?.[normalized.toLowerCase()] ?? rawText
}
