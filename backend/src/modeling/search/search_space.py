from math import prod

EXCLUDED_VALIDATION_PARAMS = {"kernel", "__space_index"}


def iter_search_spaces(search_params):
    if isinstance(search_params, dict):
        return [search_params]

    if isinstance(search_params, list):
        return [space for space in search_params if isinstance(space, dict)]

    return []


def search_space_size(space):
    candidate_sizes = []

    for param_spec in space.values():
        candidates = param_spec.grid_candidates()
        if candidates is None:
            return 0

        candidate_sizes.append(len(candidates))

    if not candidate_sizes:
        return 0

    return prod(candidate_sizes)


def effective_n_trials(search_params, requested_n_trials):
    spaces = iter_search_spaces(search_params)
    if not spaces:
        return requested_n_trials

    total_combinations = sum(search_space_size(space) for space in spaces)
    if total_combinations <= 0:
        return requested_n_trials

    return min(requested_n_trials, total_combinations)


def resolve_matching_search_space(search_params, best_params):
    spaces = iter_search_spaces(search_params)

    if not spaces:
        return None

    if len(spaces) == 1:
        return spaces[0]

    for space in spaces:
        matches = True

        for param_name, param_spec in space.items():
            if param_name not in best_params:
                continue

            if not param_spec.contains(best_params[param_name]):
                matches = False
                break

        if matches:
            return space

    return spaces[0]


def get_available_validation_params(search_params, best_params=None):
    spaces = iter_search_spaces(search_params)
    if not spaces:
        return []

    if best_params:
        matching_space = resolve_matching_search_space(search_params, best_params)
        if matching_space:
            spaces = [matching_space]

    available_params = []
    seen = set()

    for space in spaces:
        for param_name in space:
            if param_name in EXCLUDED_VALIDATION_PARAMS or param_name in seen:
                continue

            available_params.append(param_name)
            seen.add(param_name)

    return available_params
