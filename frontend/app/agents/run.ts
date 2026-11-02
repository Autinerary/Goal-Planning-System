'use client'

/**
 * Where one of the person's agents runs (lib/agents.ts), from this browser: on their device with their own model (the
 * settings in Use my own model), or on our cloud model with the model they chose in Settings.
 */
import { Agent, Runner, cloudRunner, deviceRunner } from '@/lib/agents'
import { loadOwnModel, pingMessage, pingOwnModel } from '@/lib/localModel'
import { browserModelInfo } from '@/lib/browserModel'
import { toLlmConfig } from '@/lib/modelPrefs'

export function runnerFor(agent: Agent, context: string): Runner {
  return agent.runsOn === 'cloud' ? cloudRunner(agent, context, toLlmConfig()) : deviceRunner(agent, context, loadOwnModel())
}

/** Where it runs, in words, and whether it can run now. */
export async function whereItRuns(agent: Agent): Promise<{ ready: boolean; words: string }> {
  if (agent.runsOn === 'cloud') {
    return { ready: true, words: 'Runs on our cloud model: what it may see, and what you write to it, go to the AI company that runs that model.' }
  }
  const settings = loadOwnModel()
  const ping = await pingOwnModel(settings)
  if (ping.ok && ping.hasModel) {
    const model = settings.runtime === 'browser' ? (browserModelInfo(settings.browserModel)?.label ?? settings.browserModel) + ' in this browser' : `${settings.model} in Ollama`
    return { ready: true, words: `Runs on your device (${model}). Nothing it reads or writes leaves this device.` }
  }
  return { ready: false, words: `Your own model isn’t ready: ${pingMessage(ping)} Set it up in Settings, Models, Use my own model, or let this agent use our cloud model.` }
}
