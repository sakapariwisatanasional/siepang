import { bootstrapService } from '../services/bootstrapService';
import { customerInstallationService } from '../services/customerInstallationService';
import { userManagementService } from '../services/userManagementService';

export interface BootstrapTestCaseResult {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  actualResult: string;
}

export interface BootstrapTestSuiteResult {
  passed: boolean;
  total: number;
  passedCount: number;
  failedCount: number;
  results: BootstrapTestCaseResult[];
  testedAt: string;
}

/**
 * Production-safe bootstrap regression suite.
 * It deliberately does not inject demo customers, fake bootstrap tokens,
 * fake accounts, or hard-coded installation identities.
 */
export async function runBootstrapSecuritySuite(): Promise<BootstrapTestSuiteResult> {
  const results: BootstrapTestCaseResult[] = [];

  // Test 1: An unconfigured frontend must report that the backend is unavailable,
  // rather than silently switching to a simulated bootstrap implementation.
  try {
    customerInstallationService.updateInstallationRecord({ web_app_url: '' });
    const status = await bootstrapService.getStatus();
    const passed = status.installation_ready === false && status.backend_reachable === false;
    results.push({
      id: 'BOOTSTRAP_01',
      name: 'No fake bootstrap fallback',
      description: 'Unconfigured bootstrap must fail safely without a local simulation.',
      passed,
      actualResult: JSON.stringify({
        installation_ready: status.installation_ready,
        backend_reachable: status.backend_reachable,
      }),
    });
  } catch (err: any) {
    results.push({
      id: 'BOOTSTRAP_01',
      name: 'No fake bootstrap fallback',
      description: 'Unconfigured bootstrap must fail safely without a local simulation.',
      passed: false,
      actualResult: `Error: ${err?.message || err}`,
    });
  }

  // Test 2: Verifying bootstrap administrator must not create a browser-local user.
  try {
    const before = userManagementService.getUsers().length;
    let rejected = false;
    try {
      await userManagementService.ensureBootstrapSuperadmin();
    } catch {
      rejected = true;
    }
    const after = userManagementService.getUsers().length;
    const passed = rejected && before === after;
    results.push({
      id: 'BOOTSTRAP_02',
      name: 'No local bootstrap account injection',
      description: 'Bootstrap administrator must come from authoritative GAS data.',
      passed,
      actualResult: passed
        ? 'No local user was created.'
        : `User count changed from ${before} to ${after}.`,
    });
  } catch (err: any) {
    results.push({
      id: 'BOOTSTRAP_02',
      name: 'No local bootstrap account injection',
      description: 'Bootstrap administrator must come from authoritative GAS data.',
      passed: false,
      actualResult: `Error: ${err?.message || err}`,
    });
  }

  const passedCount = results.filter(result => result.passed).length;
  return {
    passed: passedCount === results.length,
    total: results.length,
    passedCount,
    failedCount: results.length - passedCount,
    results,
    testedAt: new Date().toISOString(),
  };
}
