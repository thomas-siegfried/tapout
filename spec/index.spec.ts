import { createConfig, type TapoutConfig } from '#src/index.js';

describe('createConfig', () => {
  it('should create a config with the given name', () => {
    const config: TapoutConfig = createConfig('test');
    expect(config.name).toBe('test');
    expect(config.enabled).toBeTrue();
  });
});
