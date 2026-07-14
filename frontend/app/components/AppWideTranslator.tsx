'use client'

import { useEffect } from 'react'
import { useTranslation } from '../context/LanguageContext'
import { translatePhrase } from '@/lib/i18n'

const ORIGINAL_TEXT = new WeakMap<Text, string>()
const ATTRS = ['placeholder', 'title', 'aria-label'] as const

function shouldSkipNode(el: Element | null): boolean {
  if (!el) return true
  if (el.closest('[data-no-i18n="true"]')) return true
  if (el.closest('script, style, code, pre, textarea')) return true
  if (el.closest('[contenteditable="true"]')) return true
  return false
}

function translateTextNode(node: Text, lang: string): void {
  const parent = node.parentElement
  if (shouldSkipNode(parent)) return
  const original = ORIGINAL_TEXT.get(node) ?? node.nodeValue ?? ''
  if (!ORIGINAL_TEXT.has(node)) ORIGINAL_TEXT.set(node, original)
  const translated = translatePhrase(lang as any, original)
  if (translated !== node.nodeValue) node.nodeValue = translated
}

function attrDatasetKey(attr: string): string {
  return `i18nOrig${attr.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/^./, (c) => c.toUpperCase())}`
}

function translateElementAttrs(el: Element, lang: string): void {
  if (shouldSkipNode(el)) return
  const htmlEl = el as HTMLElement
  for (const attr of ATTRS) {
    const current = el.getAttribute(attr)
    if (!current) continue
    const key = attrDatasetKey(attr)
    const original = (htmlEl.dataset as Record<string, string | undefined>)[key] ?? current
    ;(htmlEl.dataset as Record<string, string | undefined>)[key] = original
    const translated = translatePhrase(lang as any, original)
    if (translated !== current) {
      el.setAttribute(attr, translated)
    }
  }
}

function translateSubtree(root: Node, lang: string): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, lang)
    return
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) {
    return
  }

  const rootEl = root as Element
  if (root.nodeType === Node.ELEMENT_NODE) {
    translateElementAttrs(rootEl, lang)
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let textNode = walker.nextNode()
  while (textNode) {
    translateTextNode(textNode as Text, lang)
    textNode = walker.nextNode()
  }

  if (root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE) {
    const scope = root.nodeType === Node.DOCUMENT_NODE ? document.body : (root as Element)
    scope.querySelectorAll('*').forEach((el) => translateElementAttrs(el, lang))
  }
}

/**
 * Applies phrase-based translation app-wide to existing rendered copy,
 * including content that appears after client-side navigation.
 */
export default function AppWideTranslator() {
  const { lang } = useTranslation()

  useEffect(() => {
    translateSubtree(document.body, lang)

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' && mutation.target.nodeType === Node.TEXT_NODE) {
          translateTextNode(mutation.target as Text, lang)
        }

        if (mutation.type === 'attributes' && mutation.target.nodeType === Node.ELEMENT_NODE) {
          translateElementAttrs(mutation.target as Element, lang)
        }

        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => translateSubtree(node, lang))
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    })

    return () => observer.disconnect()
  }, [lang])

  return null
}