# Condition vocabulary (8 Oct 2026)

What `scripts/sync_condition_vocabulary.py` reports, read-only, on 8 Oct 2026.
With `--apply` (after STEP 57) it stores the same mapping in
`condition_vocabulary`, and the `user_barriers_normalized` view joins it onto
`user_barriers`. The raw values are not changed. The mapping is the one the
Pattern Recognition filter already uses at query time (`match_keys` in
core/condition_taxonomy.py); no second map was made.

## For you to decide

1. **The 3 unmapped values** at the end of this file. Each one stays
   'unmapped' until you either add an alias or decide to leave it.
2. **Where the runtime map merges more than the deck's map.**
   `scripts/barrier_report.py` has a map of its own: 85 groups for today's
   92 values, against the runtime map's 65. It never merges anything the
   runtime map keeps apart, but the runtime map merges 17 groups that it
   keeps apart. 10 of those are spelling or wording variants, such as
   `Fragile X Syndrome` and `Fragile X syndrome`, or `Vision disability` and
   `visual_impairment`. The other 7 are judgement calls:
   - `Sensory Processing Disorder`, `Sensory processing differences` and
     `sensory` all become `sensory_processing`. barrier_report.py keeps them
     apart on purpose: a diagnosis, a self-description, a broad category.
   - `Cluster A`, `Cluster B` and `Cluster C` become one `personality`.
   - `Obsessive-compulsive and related conditions`, a family of conditions,
     becomes `ocd`.
   - `Reading disorder`, `Mathematics disorder` and `Written expression
     disorder` become dyslexia, dyscalculia and dysgraphia.
   - `English as an Additional Language`, `Language Barrier` and `esl`
     become one `language`.
   This is the live filter's mapping, so it is left as it is here: changing
   it changes who matches whom.
3. **barrier_report.py's account count is wrong.** It calls
   `list_users()` once, which returns only the first page (50 accounts).
   That is why it reports 50 accounts and 319 people "orphaned". There are
   392 accounts, and every user_barriers row belongs to one of them. The
   helper `list_all_users` in scripts/vector_evaluation_pull.py pages
   correctly.


Map: core/condition_taxonomy.py, version `841a277543`.

## Distinct values, before and after

Before: distinct `user_barriers.barrier_type` strings as stored. After: what they mean once normalised, counting each condition once, each placeholder once, and each unmapped value once.

| accounts | rows | people | before | after | conditions | placeholders | unmapped |
|---|---|---|---|---|---|---|---|
| real | 250 | 76 | 68 | 55 | 52 | 2 | 1 |
| team | 61 | 21 | 40 | 33 | 30 | 1 | 2 |
| synthetic | 374 | 250 | 9 | 9 | 9 | 0 | 0 |
| all | 685 | 347 | 92 | 65 | 60 | 2 | 3 |

`pattern_user_embeddings.barriers` (the copies stored with the vectors): 68 distinct before, 57 after.

## Which values map to which

### Conditions

| canonical | label | category | stored values |
|---|---|---|---|
| `autoimmune` | an autoimmune condition | chronic_health | `Autoimmune Disorder`, `Autoimmune condition` |
| `brain_injury` | an acquired brain injury | chronic_health | `Acquired brain injury` |
| `chronic_illness` | a chronic illness | chronic_health | `chronic_illness` |
| `chronic_pain` | chronic pain | chronic_health | `Other chronic pain condition` |
| `eds` | Ehlers-Danlos syndrome | chronic_health | `Ehlers-Danlos syndrome` |
| `epilepsy` | epilepsy | chronic_health | `Epilepsy` |
| `me_cfs` | ME/CFS | chronic_health | `ME/CFS` |
| `rare_genetic` | a rare or genetic condition | chronic_health | `Other rare or genetic condition` |
| `aac` | using AAC | communication | `AAC user` |
| `communication` | a communication disorder | communication | `Communication disorders`, `communication` |
| `nonspeaking` | being nonspeaking | communication | `Nonspeaking` |
| `selective_mutism` | selective mutism | communication | `Selectively speaking` |
| `social` | social communication differences | communication | `social` |
| `speech` | a speech disability | communication | `Speech disability` |
| `gender_identity` | gender identity | identity | `Gender Identity` |
| `immigrant` | being an immigrant or refugee | identity | `Immigrant / Refugee` |
| `lgbtq` | being LGBTQ+ | identity | `LGBTQ+`, `lgbtq` |
| `religious_minority` | being a religious minority | identity | `Religious Minority` |
| `visible_minority` | being a visible minority | identity | `Racialized Person (Visible Minority)`, `Visible Minority` |
| `down_syndrome` | Down syndrome | intellectual_developmental | `Down syndrome` |
| `fragile_x` | fragile X syndrome | intellectual_developmental | `Fragile X Syndrome`, `Fragile X syndrome` |
| `intellectual` | an intellectual disability | intellectual_developmental | `Intellectual disability`, `intellectual` |
| `williams` | Williams syndrome | intellectual_developmental | `Williams syndrome` |
| `language` | a language barrier | language | `English as an Additional Language`, `Language Barrier`, `esl` |
| `cognitive` | cognitive differences | learning | `cognitive` |
| `dyscalculia` | dyscalculia | learning | `Dyscalculia`, `Mathematics disorder` |
| `dysgraphia` | dysgraphia | learning | `Dysgraphia`, `Written expression disorder` |
| `dyslexia` | dyslexia | learning | `Dyslexia`, `Reading disorder`, `dyslexia` |
| `nvld` | a nonverbal learning difference | learning | `Nonverbal learning disorder` |
| `anxiety` | anxiety | mental_health | `Anxiety Disorder`, `Anxiety disorders`, `anxiety` |
| `depression` | depression | mental_health | `Depression`, `depression` |
| `mood` | a mood disorder | mental_health | `Mood disorders` |
| `ocd` | OCD | mental_health | `OCD`, `Obsessive-compulsive and related conditions` |
| `personality` | a personality disorder | mental_health | `Cluster A`, `Cluster B`, `Cluster C` |
| `psychotic` | a psychotic disorder | mental_health | `Psychotic disorders` |
| `ptsd` | PTSD | mental_health | `PTSD` |
| `sleep` | a sleep disorder | mental_health | `Sleep disorder` |
| `adhd` | ADHD | neurodevelopmental | `ADHD`, `adhd` |
| `audhd` | autism and ADHD | neurodevelopmental | `AuDHD` |
| `autism` | autism | neurodevelopmental | `Autism`, `Autism spectrum disorder`, `autism` |
| `coordination` | a coordination difference | neurodevelopmental | `Developmental coordination disorder` |
| `tourette` | Tourette syndrome | neurodevelopmental | `Tourette Syndrome` |
| `mobility` | a mobility disability | physical | `mobility` |
| `muscular_dystrophy` | muscular dystrophy | physical | `Muscular dystrophy` |
| `wheelchair` | using a wheelchair | physical | `Wheelchair user` |
| `colour_blind` | colour blindness | sensory_disability | `Color Blind` |
| `hearing` | a hearing disability | sensory_disability | `Hearing disability`, `hearing_impairment` |
| `vision` | a vision disability | sensory_disability | `Vision disability`, `visual_impairment` |
| `auditory_processing` | auditory processing differences | sensory_processing | `Auditory Processing Disorder`, `Auditory processing disorder` |
| `hyperacusis` | hyperacusis | sensory_processing | `Hyperacusis` |
| `misophonia` | misophonia | sensory_processing | `Misophonia` |
| `sensory_processing` | sensory processing differences | sensory_processing | `Sensory Processing Disorder`, `Sensory processing differences`, `sensory` |
| `synesthesia` | synesthesia | sensory_processing | `Synesthesia` |
| `first_gen` | being first generation | socioeconomic | `First Generation` |
| `food` | food insecurity | socioeconomic | `Food Insecurity` |
| `housing` | housing instability | socioeconomic | `Housing Instability` |
| `low_income` | limited income | socioeconomic | `Limited Income`, `low_income` |
| `rural` | living rurally | socioeconomic | `Rural / Remote Area` |
| `tech_access` | limited technology access | socioeconomic | `Limited Technology Access` |
| `transport` | a transportation barrier | socioeconomic | `Transportation Barrier` |

### Placeholders (their own kind, not conditions)

| canonical | label | category | stored values |
|---|---|---|---|
| `none` | No current barriers | placeholder | `No current barriers` |
| `undisclosed` | Prefer not to share | placeholder | `Prefer not to share` |

## Not mapped: for a person to decide

3 value(s). Nothing is guessed: each stays 'unmapped' until an alias is added to core/condition_taxonomy.py, or it is left as it is.

- `Having high amounts of aura` (team account)
- An instruction aimed at an AI, typed into "Other (specify)" (team account). It is the prompt-injection attempt core/condition_taxonomy.py mentions; it is not quoted here so this file doesn't carry it.
- `vvv` (real account)
