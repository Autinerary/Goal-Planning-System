import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import credits from '@/public/avatar3d/credits.json'
import { LegalPage, List, Section, linkClass } from '../components/LegalPage'

export const metadata: Metadata = {
  title: 'Credits and licences · Autinerary',
  description: 'The fonts, pictures, maps, data and open models Autinerary and ResourceHub use, and their licences.',
}

const UPDATED = '8 November 2026'

type Credit = { kind: string; id: string; asset: string; author: string; license: string; source: string }

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">{children}</a>
)

/**
 * Who made what we use, and under which licence (licences that ask for credit get it here). The character creator's
 * parts come from public/avatar3d/credits.json, which the asset pipeline writes (scripts/avatar3d); the rest is listed
 * by hand: add a line when something new comes in.
 */
export default function CreditsPage() {
  const parts = credits as Credit[]
  const byLicence = (l: string) => parts.filter((c) => c.license === l)
  const ccBy = byLicence('CC-BY')
  const ccByAuthors = Array.from(new Set(ccBy.map((c) => c.author))).sort((a, b) => a.localeCompare(b))
  const cc0Authors = Array.from(new Set(byLicence('CC0').map((c) => c.author))).sort((a, b) => a.localeCompare(b))
  return (
    <LegalPage
      title="Credits and licences"
      updated={UPDATED}
      intro={<p>Autinerary and ResourceHub are built on other people’s work. Thank you. Here is what we use, and under which licence.</p>}
    >
      <Section id="maps" title="Places, maps and weather">
        <List>
          <li>Many places in ResourceHub, and the campus pages, come from OpenStreetMap: © OpenStreetMap contributors, available under the <A href="https://opendatacommons.org/licenses/odbl/">Open Database License</A>. <A href="https://www.openstreetmap.org/copyright">openstreetmap.org/copyright</A></li>
          <li>Maps on a listing: OpenStreetMap tiles, drawn with Leaflet (BSD 2-Clause). The 3D view: <A href="https://openfreemap.org">OpenFreeMap</A>, © OpenMapTiles, data from OpenStreetMap, drawn with MapLibre GL JS (BSD 3-Clause).</li>
          <li>Weather data by <A href="https://open-meteo.com/">Open-Meteo.com</A>, under <A href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</A>.</li>
        </List>
      </Section>

      <Section id="pictures" title="Pictures and type">
        <List>
          <li>Text is set in Atkinson Hyperlegible, by the Braille Institute of America, under the <A href="https://openfontlicense.org">SIL Open Font License 1.1</A>.</li>
          <li>Icons: <A href="https://lucide.dev">Lucide</A>, under the ISC License.</li>
          <li>Spirit animals: <A href="https://github.com/twitter/twemoji">Twemoji</A> 14.0.2 graphics by Twitter and other contributors, under <A href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</A>, unchanged (the app may tint them).</li>
          <li>Your character’s face: the Avataaars design by <A href="https://avataaars.com/">Pablo Stanley</A>, free for personal and commercial use, drawn with <A href="https://www.dicebear.com">DiceBear</A> (MIT).</li>
          <li>The 3D character creator: a body and parts from the <A href="http://www.makehumancommunity.org">MakeHuman community</A>, put together with MPFB in Blender. {cc0Authors.length} makers’ parts are under CC0 (no rights reserved): {cc0Authors.join(', ')}.</li>
          {ccBy.length > 0 && (
            <li>
              Under <A href="https://creativecommons.org/licenses/by/4.0/">CC BY</A>, with thanks: {ccByAuthors.map((author, i) => (
                <span key={author}>
                  {i > 0 && '; '}
                  {author} ({ccBy.filter((c) => c.author === author).map((c) => c.asset).join(', ')})
                </span>
              ))}.
            </li>
          )}
          <li>The character’s backdrops: <A href="https://polyhaven.com">Poly Haven</A>, CC0 (Sergej Majboroda, Greg Zaal).</li>
        </List>
      </Section>

      <Section id="models" title="Open models">
        <List>
          <li>
            Qwen3 0.6B, the model you can use and tune in your browser, by the Qwen team (Alibaba Cloud), under the{' '}
            <A href="https://www.apache.org/licenses/LICENSE-2.0">Apache License 2.0</A>; run with <A href="https://webllm.mlc.ai">WebLLM</A> (Apache 2.0) and tuned with jax-js (MIT).
          </li>
          <li>
            Llama 3.2, which the training scripts can tune on your computer: <strong>Built with Llama</strong>. Llama 3.2 is
            licensed under the <A href="https://www.llama.com/llama3_2/license/">Llama 3.2 Community License</A>, Copyright © Meta
            Platforms, Inc. All Rights Reserved, and its <A href="https://www.llama.com/llama3_2/use-policy/">Acceptable Use Policy</A>{' '}
            applies to models made from it, including shared ones.
          </li>
          <li>Questions in the personality page: the <A href="https://ipip.ori.org">International Personality Item Pool</A>, in the public domain.</li>
        </List>
      </Section>

      <Section id="software" title="Software">
        <p>
          The apps are built with open-source software, including Next.js, React, Supabase, FastAPI, LangGraph, spaCy, three.js
          and Recharts, under their own licences (MIT for most). Their notices are kept with our source code.
        </p>
      </Section>
    </LegalPage>
  )
}
