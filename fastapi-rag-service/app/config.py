from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    claude_model: str = "claude-opus-4-7"

    rag_service_host: str = "0.0.0.0"
    rag_service_port: int = 8000

    chroma_persist_dir: str = "./chroma_db"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    top_k_results: int = 4

    collection_name: str = "medimind_docs"


settings = Settings()
