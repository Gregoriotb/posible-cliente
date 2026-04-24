from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)


class LoginResponse(BaseModel):
    api_key: str = Field(description="Admin API key del dashboard. Guárdala en localStorage.")
    username: str
