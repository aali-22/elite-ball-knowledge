"""The site server's settings, from the environment (or a .env file beside it). One of them is a secret: PICKLAB_KEY,
the value the web app sends to read PickLab when PickLab is private. It is only ever compared, never returned or logged."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    site_db: str = "site.db"  # the database ebk.demo or the site's own build writes
    public_origin: str = ""  # comma-separated origins allowed by CORS; empty = same-origin only
    public_hosts: str = ""  # comma-separated Host headers served; empty = any
    public_rate_per_min: int = 120  # per client IP
    public_burst: int = 40  # per client IP per 10 s
    trust_proxy: bool = False  # read the client IP from X-Forwarded-For (only behind a proxy you run)
    cache_seconds: int = 120  # how long parsed boards and documents are reused
    picklab: bool = True  # false = the analytics alone: the picks, records and strategies routes don't exist
    # PickLab by invitation: its routes answer only a request that carries PICKLAB_KEY (the web app, for a signed-in
    # visitor it lets in); to anyone else they don't exist, and /public/sources lists the analytics alone. Private
    # with no key set = locked for everyone, never open by accident.
    picklab_private: bool = False
    picklab_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
