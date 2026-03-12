import { MockGenerator } from './dist/mock-generator.js';
import { readFileSync } from 'fs';

const spec = JSON.parse(readFileSync('./test-bed/openapi-spec/spec.json', 'utf-8'));
const generator = new MockGenerator(spec);

const authOps = [
  {
    path: '/api/v1/auth/login',
    method: 'post',
    operation: spec.paths['/api/v1/auth/login'].post
  }
];

const output = generator.generateMockHandlers('auth-controller', authOps);
console.log(output);
