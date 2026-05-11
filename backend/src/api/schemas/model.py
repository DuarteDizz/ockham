from pydantic import BaseModel


class ModelItem(BaseModel):
    id: str
    name: str
    category: str
    problem_type: str


class ModelListResponse(BaseModel):
    problem_type: str
    models: list[ModelItem]
