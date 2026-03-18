export interface TapoutConfig {
  name: string;
  enabled: boolean;
}

export function createConfig(name: string): TapoutConfig {
  return { name, enabled: true };
}
