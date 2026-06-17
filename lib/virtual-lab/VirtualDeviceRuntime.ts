import { ScenarioRunner } from './ScenarioRunner';
import { createDefaultVirtualDeviceRegistry } from './VirtualDeviceRegistry';
import { getScenarioForProfile } from './scenarios';

export class VirtualDeviceRuntime {
  readonly registry = createDefaultVirtualDeviceRegistry();
  readonly runner = new ScenarioRunner();

  async run(profileId: string, mode: 'safe' | 'unsafe', prompt?: string) {
    const profile = this.registry.get(profileId);
    if (!profile) throw new Error(`Unknown virtual device profile: ${profileId}`);
    return this.runner.run(profile, getScenarioForProfile(profileId, mode), prompt);
  }
}
