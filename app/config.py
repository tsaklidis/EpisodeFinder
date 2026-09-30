from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_port: int = 8000
    srt_dir: str = "./srt_files"
    db_path: str = "./app/data/subtitles.db"
    results_per_page: int = 20

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
