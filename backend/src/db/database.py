from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from src.config import settings

settings.data_dir.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite:///{settings.sqlite_path}"


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def sync_sqlite_schema():
    inspector = inspect(engine)
    with engine.begin() as connection:
        existing_tables = set(inspector.get_table_names())
        for table_name, table in Base.metadata.tables.items():
            if table_name not in existing_tables:
                continue

            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column in table.columns:
                if column.name in existing_columns:
                    continue

                compiled_type = column.type.compile(dialect=engine.dialect)
                connection.execute(
                    text(f'ALTER TABLE "{table_name}" ADD COLUMN "{column.name}" {compiled_type}')
                )
