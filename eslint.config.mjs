import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const gatePrivateFiles = [
  'lib/hardware/HardwareExecutionGate.ts',
  'lib/hardware/Esp32DeviceAdapter.ts',
  'lib/hardware/SerialEsp32Transport.ts',
  'lib/hardware/RealDeviceTransport.ts',
  'lib/hardware/index.ts',
  'lib/hardware/internal/actuation.ts',
  'tests/real-hardware/**'
];

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // These React 19 compiler-advisory rules were not part of the previous
      // Next lint contract. Keep existing state/memoization behavior stable;
      // migrate individual components only in dedicated, verified units.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off'
    }
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: gatePrivateFiles,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/hardware/internal/*', '**/internal/actuation'],
              message: 'The actuation ticket is gate-private (audit 1.1). Route hardware execution through HardwareExecutionGate; never import lib/hardware/internal directly.'
            }
          ]
        }
      ]
    }
  },
  globalIgnores([
    '.asset-sources/**',
    '.next-*/**',
    '.next-build/**',
    '.next-dev/**',
    'dist-electron/**',
    'dist-electron-runtime/**',
    'release/**',
    '.tmp-*/**'
  ])
]);
