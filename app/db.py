from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings

_connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=_connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


_NO_OVERLAP_DDL = """
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_overlap') THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_no_overlap
      EXCLUDE USING gist (table_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
      WHERE (status = 'confirmed');
  END IF;
END $$;
"""


def init_db() -> None:
    from .models import Table

    Base.metadata.create_all(engine)
    if engine.dialect.name == "postgresql":
        # Gwarancja na poziomie bazy: dwie potwierdzone rezerwacje tego samego stolika nie mogą się nakładać.
        with engine.begin() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist"))
            conn.execute(text(_NO_OVERLAP_DDL))
    if settings.seed_demo:
        with SessionLocal() as db:
            if db.scalar(select(func.count(Table.id))) == 0:
                seats = [2, 2, 4, 4, 6, 8]
                db.add_all([Table(name=f"Stolik {i}", seats=s) for i, s in enumerate(seats, 1)])
                db.commit()
