/**
 * Guards the deploy wiring in .gitlab-ci.yml against regressions found in review:
 * unsupported `${VAR:-default}` syntax, deploys that do not pin the commit SHA,
 * production keys leaking to staging and missing host-key pinning for production.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

type Job = {
  extends?: string | string[];
  needs?: Array<string | { job: string }>;
  variables?: Record<string, string>;
  script?: string[];
  environment?: { name: string };
};

const pipeline = parse(readFileSync(join(process.cwd(), '.gitlab-ci.yml'), 'utf8')) as Record<
  string,
  Job
>;
const deployTemplate = pipeline['.deploy'];
const stagingJob = pipeline['deploy:staging'];
const productionJob = pipeline['deploy:production'];

const neededJobs = (job: Job): string[] =>
  (job.needs ?? []).map((need) => (typeof need === 'string' ? need : need.job));

describe('.gitlab-ci.yml deploy configuration', () => {
  it('never uses shell default expansion in job variables (GitLab does not support it)', () => {
    for (const [name, job] of Object.entries(pipeline)) {
      for (const [key, value] of Object.entries(job?.variables ?? {})) {
        expect(String(value), `${name}.variables.${key}`).not.toMatch(/\$\{[A-Z0-9_]+:-/);
      }
    }
  });

  it('maps each environment to its own SSH key', () => {
    expect(stagingJob.variables?.SSH_PRIVATE_KEY).toBe('$SSH_PRIVATE_KEY_STAGING');
    expect(productionJob.variables?.SSH_PRIVATE_KEY).toBe('$SSH_PRIVATE_KEY_PROD');
    expect(stagingJob.environment?.name).toBe('staging');
    expect(productionJob.environment?.name).toBe('production');
  });

  it('sends the commit SHA to the VM so the deployed version is pinned', () => {
    const script = (deployTemplate.script ?? []).join('\n');
    expect(script).toContain('"deploy $CI_COMMIT_SHORT_SHA"');
  });

  it('retags the environment tags before triggering the SSH deploy', () => {
    const script = (deployTemplate.script ?? []).join('\n');
    expect(script.indexOf('imagetools create')).toBeLessThan(
      script.indexOf('deploy $CI_COMMIT_SHORT_SHA'),
    );
  });

  it('requires a pinned host key for production', () => {
    expect(productionJob.variables?.REQUIRE_KNOWN_HOSTS).toBe('true');
  });

  it('gates both deploy jobs on the deploy script tests', () => {
    expect(pipeline['deploy-scripts']).toBeDefined();
    expect(neededJobs(stagingJob)).toContain('deploy-scripts');
    expect(neededJobs(productionJob)).toContain('deploy-scripts');
  });
});
