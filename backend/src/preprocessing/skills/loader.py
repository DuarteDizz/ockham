"""Internal skill loader for Ockham preprocessing agents.

Skills are versioned knowledge bundles stored under ``preprocessing/skills``.
They are loaded explicitly by each agent, not selected dynamically by the LLM.
This keeps the flow stable with local Ollama models while preserving the
benefits of skills: operational knowledge, contracts, examples and rubrics live
next to each specialist agent capability instead of being scattered across code.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class LoadedSkill:
    """A loaded Ockham skill bundle."""

    name: str
    description: str
    path: Path
    body: str
    references: dict[str, str]

    def render_system_prompt(self) -> str:
        """Return the complete specialist system prompt for an agent."""
        reference_blocks = []
        for relative_path, content in sorted(self.references.items()):
            reference_blocks.append(f"\n## Reference: {relative_path}\n\n{content.strip()}")

        references = "\n".join(reference_blocks)
        return f"""
{self.body.strip()}

{references}

# Global Ockham execution rules

- You are a JSON-only preprocessing specialist inside Ockham.
- You are not a chat assistant and you are not writing an analysis report.
- Use only the profile view and registry supplied in the task payload.
- Do not invent, translate, rename, pluralize or omit column names.
- Do not suggest modeling, EDA, charts, code snippets, train/test split, metrics, hyperparameter tuning or feature engineering outside the listed Ockham operations.
- Return exactly one decision for every column in output_contract.expected_columns.
- If no operation is technically needed, use the JSON literal null as operation.
- Do not use string no-op aliases such as "null", "keep", "skip", "no_operation" or "null_operation_meaning".
- The first character of your response must be {{ and the last character must be }}.
- Do not wrap JSON in markdown fences.
""".strip()


def _split_frontmatter(text: str) -> tuple[dict[str, str], str]:
    """Parse simple YAML-like frontmatter without adding a YAML dependency."""
    if not text.startswith("---"):
        return {}, text

    lines = text.splitlines()
    metadata: dict[str, str] = {}
    end_index: int | None = None

    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_index = index
            break
        if ":" in line:
            key, value = line.split(":", 1)
            metadata[key.strip()] = value.strip().strip('"').strip("'")

    if end_index is None:
        return metadata, text

    body = "\n".join(lines[end_index + 1 :])
    return metadata, body


class SkillLoader:
    """Load Ockham skill bundles from the local source tree."""

    def __init__(self, skills_root: Path | None = None):
        self.skills_root = skills_root or Path(__file__).resolve().parent

    @lru_cache(maxsize=32)
    def load(self, skill_name: str) -> LoadedSkill:
        skill_path = self.skills_root / skill_name
        skill_file = skill_path / "SKILL.md"

        if not skill_file.exists():
            raise FileNotFoundError(f"Ockham preprocessing skill not found: {skill_file}")

        raw = skill_file.read_text(encoding="utf-8")
        metadata, body = _split_frontmatter(raw)
        references = self._load_references(skill_path)

        return LoadedSkill(
            name=metadata.get("name", skill_name),
            description=metadata.get("description", ""),
            path=skill_path,
            body=body,
            references=references,
        )

    def _load_references(self, skill_path: Path) -> dict[str, str]:
        references: dict[str, str] = {}
        for path in sorted((skill_path / "references").rglob("*.md")) if (skill_path / "references").exists() else []:
            references[str(path.relative_to(skill_path))] = path.read_text(encoding="utf-8")
        return references


skill_loader = SkillLoader()
