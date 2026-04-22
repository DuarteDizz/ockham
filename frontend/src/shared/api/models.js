import { request } from './client';

export function fetchModels(problemType) {
  return request(`/models?problem_type=${problemType}`);
}
